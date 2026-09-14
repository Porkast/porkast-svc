import type { SendEmail } from '@cloudflare/workers-types';
import { CreateEmailResponse, Resend } from "resend";
import type { NotificationParams, AggregatedNotificationParams } from "../models/subscription";
import { NOTIFICATION_TEMPLATE, AGGREGATED_NOTIFICATION_TEMPLATE } from '../templates/notification';
import { LOGIN_OTP_TEMPLATE } from '../templates/login-otp';
import { ADMIN_NEW_USER_TEMPLATE } from '../templates/admin-new-user';
import { escapeHtml } from '../utils/common';

var resendInstance: Resend

export function getResendInstance(apiKey: string) {
    if (resendInstance) {
        return resendInstance
    }
    resendInstance = new Resend(apiKey)
    return resendInstance
}

export type EmailSenderEnv = {
    EMAIL?: SendEmail;
    RESEND_API_KEY?: string;
} | string;

async function executeSendEmail(
    sender: EmailSenderEnv,
    options: {
        to: string;
        from?: { email: string; name: string };
        subject: string;
        html: string;
        text?: string;
    }
) {
    const from = options.from || { email: 'noreply@porkast.com', name: 'Porkast' };

    // 1. Priority: Cloudflare native Workers EMAIL binding
    if (typeof sender === 'object' && sender.EMAIL) {
        return await sender.EMAIL.send({
            from: { email: from.email, name: from.name },
            to: options.to,
            subject: options.subject,
            html: options.html,
            text: options.text,
        });
    }

    // 2. Fallback: Resend API
    const apiKey = typeof sender === 'string' ? sender : sender?.RESEND_API_KEY;
    if (apiKey) {
        const resend = getResendInstance(apiKey);
        return await resend.emails.send({
            from: `${from.name} <${from.email}>`,
            to: [options.to],
            subject: options.subject,
            html: options.html,
            text: options.text,
        });
    }

    throw new Error('No email service configured: neither env.EMAIL nor RESEND_API_KEY is available');
}

function renderTemplate(template: string, params: Record<string, any>): string {
    let result = template
    for (const [key, value] of Object.entries(params)) {
        if (Array.isArray(value)) {
            const sectionRegex = new RegExp(`{{#${key}}}([\\s\\S]*?){{\/${key}}}`, 'g')
            result = result.replace(sectionRegex, (_, sectionContent) => {
                return value.map((v: any) => sectionContent.replace(/{{\.}}/g, v)).join('')
            })
        } else {
            const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g')
            result = result.replace(regex, String(value ?? ''))
        }
    }
    return result
}

export async function sendSubscriptionUpdateEmail(
    sender: EmailSenderEnv,
    params: NotificationParams
): Promise<any> {
    const htmlTempText = renderTemplate(NOTIFICATION_TEMPLATE, {
        keyword: params.keyword,
        nickname: params.nickname,
        updateCount: params.updateCount,
        titleList: params.titleList,
        link: params.link
    });
    const textContent = `Hi ${params.nickname || 'there'},\n\n` +
        `There are ${params.updateCount} new podcast episodes updated for #${params.keyword}:\n\n` +
        (params.titleList?.map((t) => `- ${t}`).join('\n') || '') +
        `\n\nListen now: ${params.link}`;

    return executeSendEmail(sender, {
        to: params.to,
        from: { email: 'noreply@porkast.com', name: 'Porkast' },
        subject: params.subject,
        html: htmlTempText,
        text: textContent,
    });
}

export async function sendAggregatedSubscriptionUpdateEmail(
    sender: EmailSenderEnv,
    params: AggregatedNotificationParams,
    options?: { webBaseUrl?: string }
): Promise<any> {
    const isSingle = params.keywordUpdates.length === 1;
    const firstUpdate = params.keywordUpdates[0];

    const subject = params.subject || (isSingle
        ? `#${firstUpdate.keyword} has new podcasts update`
        : `${params.totalUpdateCount} new episodes across ${params.keywordUpdates.length} subscriptions`);

    const headerTitle = isSingle
        ? `#${firstUpdate.keyword} has ${params.totalUpdateCount} new podcast update${params.totalUpdateCount > 1 ? 's' : ''}`
        : `${params.totalUpdateCount} new podcast updates across ${params.keywordUpdates.length} subscriptions`;

    const headerSubtitle = isSingle
        ? `Your subscription #${firstUpdate.keyword} has new podcast updates.`
        : `Your subscribed keywords have new podcast updates:`;

    const mainLink = isSingle
        ? firstUpdate.link
        : (options?.webBaseUrl || 'https://porkast.com');

    const buttonText = isSingle ? 'Listen Now' : 'View on Porkast';

    const keywordSectionsHtml = params.keywordUpdates.map((k) => {
        const episodeListHtml = k.titleList && k.titleList.length > 0
            ? `<ul style="margin: 0; padding-left: 18px; color: #555; font-size: 14px; line-height: 22px;">
                ${k.titleList.map((t) => `<li style="margin-bottom: 4px;">${escapeHtml(t)}</li>`).join('')}
               </ul>`
            : '';

        return `<div style="margin-bottom: 16px; padding: 14px 16px; background: #fdfdfd; border-left: 4px solid #2F67F6; border-radius: 4px; border-top: 1px solid #eee; border-right: 1px solid #eee; border-bottom: 1px solid #eee;">
            <div style="font-size: 16px; font-weight: bold; margin-bottom: 8px; color: #333;">
                <a href="${k.link}" target="_blank" style="color: #2F67F6; text-decoration: none;">#${escapeHtml(k.keyword)}</a>
                <span style="font-size: 13px; font-weight: normal; color: #888; margin-left: 8px;">(${k.updateCount} new)</span>
            </div>
            ${episodeListHtml}
            <div style="margin-top: 8px;">
                <a href="${k.link}" target="_blank" style="font-size: 13px; color: #2F67F6; text-decoration: underline;">View episodes &rarr;</a>
            </div>
        </div>`;
    }).join('');

    const htmlTempText = renderTemplate(AGGREGATED_NOTIFICATION_TEMPLATE, {
        headerTitle,
        nickname: params.nickname,
        headerSubtitle,
        keywordSectionsHtml,
        link: mainLink,
        buttonText,
    });

    const textContent = `Hi ${params.nickname || 'there'},\n\n` +
        (isSingle
            ? `There are ${params.totalUpdateCount} new podcast episodes updated for #${firstUpdate.keyword}:\n\n` +
              (firstUpdate.titleList?.map((t) => `- ${t}`).join('\n') || '') +
              `\n\nListen now: ${firstUpdate.link}`
            : `You have ${params.totalUpdateCount} new podcast episodes across ${params.keywordUpdates.length} subscriptions:\n\n` +
              params.keywordUpdates.map((k) =>
                  `#${k.keyword} (${k.updateCount} new):\n` +
                  (k.titleList?.map((t) => `  - ${t}`).join('\n') || '') +
                  `\n  Link: ${k.link}`
              ).join('\n\n') +
              `\n\nListen now: ${mainLink}`) +
        `\n\nBest regards,\nPorkast Team`;

    return executeSendEmail(sender, {
        to: params.to,
        from: { email: 'noreply@porkast.com', name: 'Porkast' },
        subject,
        html: htmlTempText,
        text: textContent,
    });
}

export async function sendLoginOtpEmail(
    sender: EmailSenderEnv,
    to: string,
    code: string,
    expiresMinutes: number
): Promise<any> {
    const htmlTempText = renderTemplate(LOGIN_OTP_TEMPLATE, { code, expiresMinutes });
    const textContent = `Your Porkast sign in code is: ${code}\n\nThis code expires in ${expiresMinutes} minutes. If you did not request this, you can safely ignore this email.`;

    return executeSendEmail(sender, {
        to: to,
        from: { email: 'noreply@porkast.com', name: 'Porkast' },
        subject: `${code} is your Porkast sign in code`,
        html: htmlTempText,
        text: textContent,
    });
}

export async function sendAdminNewUserEmail(
    sender: EmailSenderEnv,
    adminEmail: string,
    porkastWebBaseUrl: string | undefined,
    user: {
        userId: string;
        email?: string | null;
        nickname?: string | null;
        telegramId?: string | null;
        regDate: string;
        source: 'email' | 'telegram' | 'sync';
    }
): Promise<any> {
    const htmlTempText = renderTemplate(ADMIN_NEW_USER_TEMPLATE, {
        userId: user.userId,
        email: user.email || 'N/A',
        nickname: user.nickname || 'N/A',
        telegramId: user.telegramId || 'N/A',
        regDate: user.regDate,
        source: user.source,
        adminUserLink: porkastWebBaseUrl
            ? `<a href="${porkastWebBaseUrl}/admin/users/${user.userId}" class="btn" target="_blank">View User in Admin</a>`
            : '',
    });
    const textContent = `New user registered:\n` +
        `User ID: ${user.userId}\n` +
        `Nickname: ${user.nickname || 'N/A'}\n` +
        `Email: ${user.email || 'N/A'}\n` +
        `Telegram ID: ${user.telegramId || 'N/A'}\n` +
        `Source: ${user.source}\n` +
        `Date: ${user.regDate}`;

    return executeSendEmail(sender, {
        to: adminEmail,
        from: { email: 'noreply@porkast.com', name: 'Porkast' },
        subject: `[Porkast Admin] New User: ${user.nickname || user.userId}`,
        html: htmlTempText,
        text: textContent,
    });
}

