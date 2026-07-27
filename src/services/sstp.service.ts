import { PrismaClient } from '@prisma/client';
import { exec } from 'child_process';
import path from 'path';

const prisma = new PrismaClient();
const isLinux = process.platform === 'linux';
const SSH_KEY_PATH = process.env.VPS_SSH_KEY || path.join(__dirname, '../../ls-key.pem');
const VPS_IP = process.env.VPS_PUBLIC_IP || '103.196.155.87';
const VPS_USER = process.env.VPS_USER || 'asepsuryadi';
const MAIN_DOMAIN = process.env.MAIN_DOMAIN || 'absenta.id';

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
  const cmd = `sudo vpncmd 127.0.0.1:5555 /SERVER /HUB:DEFAULT /CMD UserCreate ${username} /GROUP:"" /REALNAME:"${safeComment}" /NOTE:"${safeComment}"; sudo vpncmd 127.0.0.1:5555 /SERVER /HUB:DEFAULT /CMD UserPasswordSet ${username} /PASSWORD:${password}`;
  await execVpsCommand(cmd);
}

// Sync user deletion to SoftEther VPN server
async function syncDeleteUserFromSoftEther(username: string) {
  const cmd = `sudo vpncmd 127.0.0.1:5555 /SERVER /HUB:DEFAULT /CMD UserDelete ${username}`;
  await execVpsCommand(cmd);
}

// Sync user password update to SoftEther VPN server
async function syncUpdateUserPasswordInSoftEther(username: string, password: string) {
  const cmd = `sudo vpncmd 127.0.0.1:5555 /SERVER /HUB:DEFAULT /CMD UserPasswordSet ${username} /PASSWORD:${password}`;
  await execVpsCommand(cmd);
}

// Fetch active connected sessions from SoftEther
async function getActiveSessions(): Promise<string[]> {
  try {
    const cmd = `sudo vpncmd 127.0.0.1:5555 /SERVER /HUB:DEFAULT /CMD SessionList`;
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
  return `# ========================================================
# SKRIP SETUP SSTP CLIENT MIKROTIK (ROUTEROS v6)
# Deskripsi / Instansi : ${commentText}
# Target VPS Server    : ${MAIN_DOMAIN}:4443
# Username Client      : ${account.username}
# ========================================================

/interface sstp-client add connect-to=${MAIN_DOMAIN} port=4443 name=sstp-out-absenta user="${account.username}" password="${account.password}" profile=default-encryption verify-server-certificate=no add-default-route=no disabled=no comment="SSTP Tunnel Absenta HQ - ${commentText}"
`;
}

