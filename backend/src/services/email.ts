import { Resend } from 'resend';
import { AgentEmailPayload, DispatchRecord } from '../types.ts';
import { Database } from '../db.ts';

function escapeHtml(text?: string | number | null): string {
  if (text === undefined || text === null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Get configured Resend instance and sender address.
 * Reads first from database config (if user updated in UI),
 * then falls back to process.env.
 */
export function getResendClient(): { client: Resend | null; fromEmail: string } {
  const db = Database.getInstance();
  const apiKey = db.getRawResendApiKey() || process.env.RESEND_API_KEY || '';
  let fromEmail = db.getRawResendFromEmail() || process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

  // If sender email is a placeholder/unverified local domain, automatically use onboarding@resend.dev
  if (!fromEmail || fromEmail.includes('.local') || fromEmail.includes('example.com')) {
    fromEmail = 'onboarding@resend.dev';
  }

  if (!apiKey || apiKey.trim() === '') {
    return { client: null, fromEmail };
  }

  return { client: new Resend(apiKey.trim()), fromEmail: fromEmail.trim() };
}

/**
 * Single backend email builder.
 * CRITICAL PRIVACY ARCHITECTURE:
 * The function signature accepts only AgentEmailPayload.
 * AgentEmailPayload intentionally has NO client_phone property,
 * guaranteeing client contact details can never leak to agents.
 */
export function buildAgentEmail(payload: AgentEmailPayload): { subject: string; html: string } {
  const typeLabel = payload.type === 'package' ? 'Package' : 'Ticket';
  const tripTypeLabel = payload.tripType === 'single' ? ' (One-Way)' : payload.tripType === 'return' ? ' (Round-Trip)' : '';
  const subject = `New ${typeLabel}${tripTypeLabel} Inquiry #${payload.inquiryNumber} - ${payload.destination}`;

  // Date formatting
  let dateDisplay = '';
  if (payload.dateMode === 'anytime') {
    if (payload.dateMessage && payload.dateMessage.trim()) {
      dateDisplay = `Anytime (Flexible): ${escapeHtml(payload.dateMessage.trim())}`;
    } else if (payload.startDate && payload.endDate) {
      dateDisplay = `Anytime between ${escapeHtml(payload.startDate)} and ${escapeHtml(payload.endDate)}`;
    } else {
      dateDisplay = 'Anytime (Flexible)';
    }
  } else {
    if (payload.startDate && payload.endDate) {
      dateDisplay = `${escapeHtml(payload.startDate)} to ${escapeHtml(payload.endDate)}`;
    } else if (payload.startDate) {
      dateDisplay = `From ${escapeHtml(payload.startDate)}`;
    } else if (payload.endDate) {
      dateDisplay = `Until ${escapeHtml(payload.endDate)}`;
    } else {
      dateDisplay = 'Dates to be decided / Flexible';
    }
  }

  // Stops formatting for Tour Packages
  let stopsHtml = '';
  if (payload.type === 'package' && payload.stops && payload.stops.length > 0) {
    const stopsList = payload.stops
      .map(
        (s, idx) =>
          `<tr><td style="padding: 6px 12px; border-bottom: 1px solid #e2e8f0; color: #475569;">Stop ${idx + 1}: <strong>${escapeHtml(
            s.place
          )}</strong></td><td style="padding: 6px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 600; color: #1e293b;">${
            s.nights && s.nights > 0 ? `${escapeHtml(s.nights)} night${s.nights > 1 ? 's' : ''}` : 'Nights TBD'
          }</td></tr>`
      )
      .join('');
    stopsHtml = `
      <div style="margin: 16px 0;">
        <div style="font-size: 13px; font-weight: 600; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; margin-bottom: 8px;">Itinerary &amp; Night Stays</div>
        <table style="width: 100%; border-collapse: collapse; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; font-size: 14px;">
          ${stopsList}
        </table>
      </div>
    `;
  }

  // Ticket specific fields
  let ticketDetailsHtml = '';
  if (payload.type === 'ticket') {
    const flightClass = payload.travelClass || 'Standard Economy';
    const airline = payload.airlinePref ? escapeHtml(payload.airlinePref) : 'Any / Best Fare';
    const returnInfo =
      payload.tripType === 'return' && payload.returnDate
        ? `<tr><td style="padding: 8px 12px; font-weight: 600; color: #475569; width: 140px;">Return Date:</td><td style="padding: 8px 12px; color: #0f172a;">${escapeHtml(
            payload.returnDate
          )}</td></tr>`
        : '';

    ticketDetailsHtml = `
      <tr><td style="padding: 8px 12px; font-weight: 600; color: #475569; width: 140px;">Class:</td><td style="padding: 8px 12px; color: #0f172a;">${escapeHtml(
        flightClass
      )}</td></tr>
      <tr><td style="padding: 8px 12px; font-weight: 600; color: #475569; width: 140px;">Preferred Airline:</td><td style="padding: 8px 12px; color: #0f172a;">${airline}</td></tr>
      ${returnInfo}
    `;
  }

  // Optional notes
  let notesHtml = '';
  if (payload.notes && payload.notes.trim()) {
    notesHtml = `
      <div style="margin-top: 16px; padding: 12px 16px; background: #fffbeb; border: 1px solid #fef3c7; border-radius: 6px; font-size: 13px; color: #92400e;">
        <strong>Special Notes / Requirements:</strong><br/>
        <div style="margin-top: 4px; white-space: pre-wrap;">${escapeHtml(payload.notes.trim())}</div>
      </div>
    `;
  }

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px; color: #0f172a;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 10px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    
    <!-- Header banner -->
    <div style="background: #0f172a; color: #ffffff; padding: 20px 24px;">
      <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; font-weight: 600;">Travel Quote Request · #${escapeHtml(
        payload.inquiryNumber
      )}</div>
      <h1 style="margin: 4px 0 0 0; font-size: 20px; font-weight: 700; color: #ffffff;">${escapeHtml(
        payload.destination
      )}</h1>
    </div>

    <!-- Body content -->
    <div style="padding: 24px;">
      <p style="font-size: 15px; line-height: 1.5; margin: 0 0 16px 0;">
        Dear <strong>${escapeHtml(payload.agentName)}</strong>,
      </p>
      <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 20px 0;">
        We have a new quote request for client <strong>${escapeHtml(
          payload.clientName
        )}</strong>. Please review the trip specifications below and reply with your best quote and itinerary breakdown.
      </p>

      <!-- Specifications Table -->
      <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 16px; border: 1px solid #e2e8f0; border-radius: 6px;">
        <tbody>
          <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 8px 12px; font-weight: 600; color: #475569; width: 140px;">Type:</td>
            <td style="padding: 8px 12px; color: #0f172a; font-weight: 600;">${escapeHtml(typeLabel)}${tripTypeLabel}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 8px 12px; font-weight: 600; color: #475569;">Destination:</td>
            <td style="padding: 8px 12px; color: #0f172a;">${escapeHtml(payload.destination)}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 8px 12px; font-weight: 600; color: #475569;">Pickup Point:</td>
            <td style="padding: 8px 12px; color: #0f172a;">${escapeHtml(payload.pickup) || 'Flexible / TBD'}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 8px 12px; font-weight: 600; color: #475569;">Drop Point:</td>
            <td style="padding: 8px 12px; color: #0f172a;">${escapeHtml(payload.drop) || 'Flexible / TBD'}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 8px 12px; font-weight: 600; color: #475569;">Travel Dates:</td>
            <td style="padding: 8px 12px; color: #0f172a; font-weight: 500;">${dateDisplay}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 8px 12px; font-weight: 600; color: #475569;">Passengers:</td>
            <td style="padding: 8px 12px; color: #0f172a;">${escapeHtml(payload.adults)} Adult${
    payload.adults > 1 ? 's' : ''
  }${payload.children > 0 ? `, ${escapeHtml(payload.children)} Child${payload.children > 1 ? 'ren' : ''}` : ''}</td>
          </tr>
          ${ticketDetailsHtml}
        </tbody>
      </table>

      ${stopsHtml}
      ${notesHtml}

      <!-- Call to Action -->
      <div style="margin-top: 24px; padding: 16px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; text-align: center;">
        <p style="margin: 0; font-size: 14px; font-weight: 600; color: #166534;">
          Please reply with your best quote.
        </p>
        <p style="margin: 4px 0 0 0; font-size: 12px; color: #15803d;">
          Reply directly to this email with tariff and itinerary availability.
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 14px 24px; font-size: 11px; color: #94a3b8; text-align: center;">
      Travel Inquiry Dispatcher · Private Agent Quotation Portal · Inquiry #${escapeHtml(payload.inquiryNumber)}
    </div>
  </div>
</body>
</html>
  `;

  return { subject, html };
}

/**
 * Dispatch an inquiry email to a specific agent individually using the Resend API client.
 */
export async function dispatchToAgent(
  agent: { id: string; name: string; email: string },
  payload: AgentEmailPayload
): Promise<DispatchRecord> {
  const { client, fromEmail } = getResendClient();

  const { subject, html } = buildAgentEmail({
    ...payload,
    agentName: agent.name,
  });

  const dispatchId = 'disp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  const now = new Date().toISOString();

  // If no Resend API key is configured, create a high-fidelity test preview
  if (!client) {
    return {
      id: dispatchId,
      agentId: agent.id,
      agentName: agent.name,
      agentEmail: agent.email,
      status: 'test_preview',
      sentAt: now,
      subject,
      previewHtml: html,
      errorText: 'Test Mode: Resend API Key not configured. Email preview generated successfully.',
    };
  }

  // Live Resend client dispatch
  try {
    const { data, error } = await client.emails.send({
      from: fromEmail,
      to: [agent.email],
      subject,
      html,
    });

    if (error) {
      let friendlyError = error.message || 'Resend API returned an error';
      if (friendlyError.includes('You can only send testing emails to your own email address')) {
        friendlyError = `Resend Test Mode Restriction: In sandbox mode, emails can only be sent to your registered Resend account (${friendlyError.match(/\(([^)]+)\)/)?.[1] || 'jaymistry1804@gmail.com'}). To send to any agent, verify a domain in Resend.`;
      }
      console.warn(`[Resend Error Handled] Agent: ${agent.email}, Reason: ${friendlyError}`);
      return {
        id: dispatchId,
        agentId: agent.id,
        agentName: agent.name,
        agentEmail: agent.email,
        status: 'failed',
        errorText: friendlyError,
        sentAt: now,
        subject,
        previewHtml: html,
      };
    }

    console.log(`[Resend Live Dispatch] Successfully sent to ${agent.email}, Message ID: ${data?.id}`);
    return {
      id: dispatchId,
      agentId: agent.id,
      agentName: agent.name,
      agentEmail: agent.email,
      status: 'sent',
      sentAt: now,
      subject,
      previewHtml: html,
    };
  } catch (err: any) {
    console.error(`[Resend Exception] Agent: ${agent.email}, Exception:`, err);
    return {
      id: dispatchId,
      agentId: agent.id,
      agentName: agent.name,
      agentEmail: agent.email,
      status: 'failed',
      errorText: err.message || 'Network connection error while contacting Resend',
      sentAt: now,
      subject,
      previewHtml: html,
    };
  }
}
