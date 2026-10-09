import { PrismaClient } from '@prisma/client';
import { exec } from 'child_process';
import path from 'path';

const prisma = new PrismaClient();
const isLinux = process.platform === 'linux';
const SSH_KEY_PATH = process.env.VPS_SSH_KEY || path.join(__dirname, '../../ls-key.pem');
const VPS_IP = process.env.VPS_PUBLIC_IP || '103.196.155.87';
const VPS_USER = process.env.VPS_USER || 'asepsuryadi';

// Helper to execute commands locally on VPS or via SSH
function execVpsCommand(cmd: string): Promise<string> {
  return new Promise((resolve) => {
    let fullCmd = cmd;
    if (!isLinux) {
      // In development on Windows, run command remotely via SSH
      fullCmd = `ssh -i "${SSH_KEY_PATH}" -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_IP} "${cmd.replace(/"/g, '\\"')}"`;
    }
    exec(fullCmd, (err, stdout, stderr) => {
      if (err) {
        console.error(`[SSTP-Service] Command failed: ${fullCmd}`, stderr || err.message);
        return resolve(''); // Return empty string on failure instead of throwing so DB ops still work
      }
      resolve(stdout.trim());
    });
  });
}

// Sync user creation to SoftEther VPN server
async function syncCreateUserToSoftEther(username: string, password: string, comment?: string) {
  const safeComment = comment ? comment.replace(/['"]/g, '') : 'MikroTik v6 Client';
  const cmd = `vpncmd 127.0.0.1:5555 /SERVER /PASSWORD:'' /HUB:DEFAULT /CMD UserCreate ${username} /GROUP:"" /REALNAME:"${safeComment}" /NOTE:"${safeComment}"; vpncmd 127.0.0.1:5555 /SERVER /PASSWORD:'' /HUB:DEFAULT /CMD UserPasswordSet ${username} /PASSWORD:${password}`;
  await execVpsCommand(cmd);
}

// Sync user deletion to SoftEther VPN server
async function syncDeleteUserFromSoftEther(username: string) {
  const cmd = `vpncmd 127.0.0.1:5555 /SERVER /PASSWORD:'' /HUB:DEFAULT /CMD UserDelete ${username}`;
  await execVpsCommand(cmd);
}

// Sync user password update to SoftEther VPN server
async function syncUpdateUserPasswordInSoftEther(username: string, password: string) {
  const cmd = `vpncmd 127.0.0.1:5555 /SERVER /PASSWORD:'' /HUB:DEFAULT /CMD UserPasswordSet ${username} /PASSWORD:${password}`;
  await execVpsCommand(cmd);
}

// Fetch active connected sessions from SoftEther
async function getActiveSessions(): Promise<string[]> {
  try {
    const cmd = `vpncmd 127.0.0.1:5555 /SERVER /PASSWORD:'' /HUB:DEFAULT /CMD SessionList`;
    const stdout = await execVpsCommand(cmd);
    if (!stdout) return [];

    const activeUsernames: string[] = [];
    const lines = stdout.split('\n');
    lines.forEach(line => {
      if (line.includes('SID-') || line.includes('User Name')) {
        const parts = line.split('|').map(p => p.trim());
        if (parts.length >= 2 && parts[0].toLowerCase().includes('user name')) {
          activeUsernames.push(parts[1]);
        }
      }
    });
    return activeUsernames;
  } catch {
    return [];
  }
}

export async function getNextAvailableIp(): Promise<string> {
  const accounts = await prisma.sstpAccount.findMany({ select: { ipAddress: true } });
  const usedIps = new Set(accounts.map(a => a.ipAddress));

  for (let i = 10; i <= 254; i++) {
    const candidate = `10.0.1.${i}`;
    if (!usedIps.has(candidate)) {
      return candidate;
    }
  }
  return '10.0.1.254';
}

export async function listSstpAccounts() {
  const [accounts, activeUsers] = await Promise.all([
    prisma.sstpAccount.findMany({ orderBy: { createdAt: 'desc' } }),
    getActiveSessions()
  ]);

  const activeSet = new Set(activeUsers.map(u => u.toLowerCase()));

  return accounts.map(acc => ({
    ...acc,
    isOnline: activeSet.has(acc.username.toLowerCase())
  }));
}

export async function createSstpAccount(data: {
  username: string;
  password: string;
  ipAddress?: string;
  comment?: string;
}) {
  const usernameClean = data.username.trim().toLowerCase();
  const existing = await prisma.sstpAccount.findUnique({ where: { username: usernameClean } });
  if (existing) {
    throw new Error(`Username SSTP '${usernameClean}' sudah digunakan.`);
  }

  const assignedIp = data.ipAddress?.trim() || (await getNextAvailableIp());
  const newAccount = await prisma.sstpAccount.create({
    data: {
      username: usernameClean,
      password: data.password.trim(),
      ipAddress: assignedIp,
      comment: data.comment?.trim() || null,
      isActive: true
    }
  });

  // Sync to VPS SoftEther
  await syncCreateUserToSoftEther(newAccount.username, newAccount.password, newAccount.comment || undefined);

  return newAccount;
}

export async function updateSstpAccount(id: string, data: {
  password?: string;
  comment?: string;
  isActive?: boolean;
}) {
  const existing = await prisma.sstpAccount.findUnique({ where: { id } });
  if (!existing) {
    throw new Error('Akun SSTP tidak ditemukan.');
  }

  const updateData: any = {};
  if (data.password !== undefined && data.password.trim() !== '') {
    updateData.password = data.password.trim();
  }
  if (data.comment !== undefined) {
    updateData.comment = data.comment.trim();
  }
  if (data.isActive !== undefined) {
    updateData.isActive = data.isActive;
  }

  const updated = await prisma.sstpAccount.update({
    where: { id },
    data: updateData
  });

  if (data.password && data.password.trim() !== '') {
    await syncUpdateUserPasswordInSoftEther(updated.username, updated.password);
  }

  return updated;
}

export async function deleteSstpAccount(id: string) {
  const existing = await prisma.sstpAccount.findUnique({ where: { id } });
  if (!existing) {
    throw new Error('Akun SSTP tidak ditemukan.');
  }

  await prisma.sstpAccount.delete({ where: { id } });
  await syncDeleteUserFromSoftEther(existing.username);

  return { success: true, username: existing.username };
}

export function generateMikrotikScript(account: {
  username: string;
  password: string;
  comment?: string | null;
}) {
  const commentText = account.comment ? account.comment.replace(/[\r\n"']/g, ' ') : 'Klien MikroTik RouterOS v6';

  const ovpnScript = `# ========================================================
# SKRIP SETUP OPENVPN CLIENT MIKROTIK (ROUTEROS v6 & v7)
# Protokol             : OpenVPN TCP Mode (Port 1194)
# Keunggulan           : Terbukti 100% Berhasil pada ROS v6, Tembus NAT & Firewall ISP
# Deskripsi / Instansi : ${commentText}
# Endpoint Server      : ${VPS_IP}:1194
# Username Client      : ${account.username}
# ========================================================

/interface ovpn-client remove [find name="ovpn-absenta"]
/interface ovpn-client add name="ovpn-absenta" connect-to="${VPS_IP}" port=1194 mode=ip user="${account.username}" password="${account.password}" profile=default certificate=none verify-server-certificate=no auth=sha1 cipher=aes128 add-default-route=no disabled=no comment="${commentText}"
`;

  const sstpScript = `# ========================================================
# SKRIP SETUP SSTP CLIENT MIKROTIK (ROUTEROS v6 & v7)
# Protokol             : SSTP (SSL VPN TCP Port 4443)
# Keunggulan           : Tembus NAT / ISP / Seluler
# Deskripsi / Instansi : ${commentText}
# Endpoint Server      : ${VPS_IP}:4443
# Username Client      : ${account.username}
# ========================================================

/interface sstp-client remove [find name="sstp-out-absenta"]
/interface sstp-client add name="sstp-out-absenta" connect-to="${VPS_IP}:4443" user="${account.username}" password="${account.password}" profile=default verify-server-certificate=no disabled=no comment="${commentText}"
`;

  const l2tpScript = `# ========================================================
# SKRIP SETUP L2TP CLIENT MIKROTIK (ROUTEROS v6 & v7)
# Protokol             : L2TP / IPsec Client (Port 1701 & 500/4500)
# Deskripsi / Instansi : ${commentText}
# Endpoint Server      : ${VPS_IP}
# Username Client      : ${account.username}
# ========================================================

/interface l2tp-client remove [find name="l2tp-out-absenta"]
/interface l2tp-client add name="l2tp-out-absenta" connect-to="${VPS_IP}" user="${account.username}" password="${account.password}" use-ipsec=yes ipsec-secret="absenta" allow=mschap2,mschap1,pap disabled=no comment="${commentText}"
`;

  return {
    ovpnScript,
    sstpScript,
    l2tpScript,
    script: ovpnScript, // default script
    vpsIp: VPS_IP,
    ovpnEndpoint: `${VPS_IP}:1194`,
    sstpEndpoint: `${VPS_IP}:4443`,
    l2tpEndpoint: `${VPS_IP}:1701`
  };
}
















