import { PrismaClient } from '@prisma/client';
import { sendLicenseWhatsAppNotification, sendOwnerOrderNotification } from '../helpers';

const prisma = new PrismaClient();

interface LicenseAndSubscriptionData {
  productId: string;
  schoolName: string;
  deviceLimit: number;
  isUnlimited: number;
  expiresAt: string;
  status: string;
  isActive: number;
  planId: string;
  requestedSlug?: string | null;
  wireguardIp?: string | null;
  includeVpn: number;
  operatorPhone?: string | null;
  npsn?: string | null;
  originalDeviceId?: string | null;
}

export async function createLicenseAndSubscription(licenseKey: string, data: LicenseAndSubscriptionData) {
  return await prisma.$transaction(async (tx) => {
    // 1. Create License
    const license = await tx.license.create({
      data: {
        licenseKey,
        productId: data.productId,
        schoolName: data.schoolName,
        deviceLimit: data.deviceLimit,
        isUnlimited: data.isUnlimited,
        expiresAt: data.expiresAt,
        status: data.status,
        isActive: data.isActive,
        planId: data.planId,
        requestedSlug: data.requestedSlug,
        wireguardIp: data.wireguardIp,
        includeVpn: data.includeVpn,
        operatorPhone: data.operatorPhone,
        npsn: data.npsn,
        originalDeviceId: data.originalDeviceId
      }
    });

    // 2. Create Subscription
    const subscription = await tx.subscription.create({
      data: {
        licenseId: license.id,
        schoolName: data.schoolName,
        productId: data.productId,
        planId: data.planId,
        status: data.status,
        startDate: '',
        endDate: ''
      }
    });

    return { license, subscription };
  });
}

interface InvoiceData {
  invoiceNumber: string;
  licenseId: string;
  schoolName: string;
  productId: string;
  planTitle: string;
  amount: number;
  status: string;
  paymentMethod: string;
  paymentInstructions: any;
  expiredTime: string;
  planId?: string | null;
}

export async function createInvoice(data: InvoiceData) {
  return await prisma.invoice.create({
    data: {
      invoiceNumber: data.invoiceNumber,
      licenseId: data.licenseId,
      schoolName: data.schoolName,
      productId: data.productId,
      planTitle: data.planTitle,
      amount: data.amount,
      status: data.status,
      paymentMethod: data.paymentMethod,
      paymentInstructions: data.paymentInstructions,
      expiredTime: data.expiredTime,
      planId: data.planId
    }
  });
}

export async function sendBothWaNotifications(
  phone: string,
  schoolName: string,
  slug: string | null,
  prodId: string,
  planName: string,
  key: string,
  invoiceNum: string,
  amount: number,
  paymentMethod: string,
  status: 'paid' | 'unpaid',
  payCode?: string | null,
  qrUrl?: string | null
) {
  await Promise.allSettled([
    sendLicenseWhatsAppNotification(
      phone,
      schoolName,
      slug,
      prodId,
      planName,
      key,
      invoiceNum,
      amount,
      paymentMethod,
      status,
      payCode,
      qrUrl
    ),
    sendOwnerOrderNotification(
      schoolName,
      slug,
      prodId,
      planName,
      key,
      invoiceNum,
      amount,
      paymentMethod
    )
  ]);
}
