export interface RenderedEmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export interface EmailTemplateData {
  recipientName?: string;
  agencyName?: string;
  agencySlug?: string;
  title: string;
  body?: string;
  clientName?: string;
  campaignName?: string;
  workName?: string;
  stageName?: string;
  dueDate?: string;
  deepLink?: string;
  token?: string;
  additionalContext?: string;
  frontendUrl?: string;
}

export function buildDeepLink(
  frontendUrl: string,
  path: string,
  agencySlug?: string,
): string {
  const base = frontendUrl.replace(/\/$/, "");
  const route = path.replace(/^\//, "");

  // If localhost, use path-based routing (http://localhost:3000/agencySlug/route)
  if (base.includes("localhost") || base.includes("127.0.0.1")) {
    if (agencySlug && !route.startsWith(agencySlug)) {
      return `${base}${route ? `/${route}` : ""}`;
    }
    return `${base}/${route}`;
  }

  // Production:
  // App routes without an agencySlug stay on app.agencie.in.
  // Agency workspace routes become https://agencySlug.agencie.in/route
  if (agencySlug) {
    try {
      const parsedUrl = new URL(base);
      const rootDomain =
        process.env.ROOT_DOMAIN ||
        process.env.NEXT_PUBLIC_ROOT_DOMAIN ||
        "agencie.in";
      const cleanRoute = route.startsWith(`${agencySlug}/`)
        ? route.slice(agencySlug.length + 1)
        : route === agencySlug
          ? ""
          : route;
      return `${parsedUrl.protocol}/.${rootDomain}${cleanRoute ? `/${cleanRoute}` : ""
        }`;
    } catch {
      return `${base}/${route}`;
    }
  }
  return `${base}/${route}`;
}

export function renderEmailTemplate(
  eventType: string,
  data: EmailTemplateData,
): RenderedEmailTemplate {
  const frontendUrl = data.frontendUrl || "https://app.agencie.in";
  const recipient = data.recipientName || "there";
  const agency = data.agencyName || "your agency";
  const deepLink = data.deepLink || frontendUrl;

  const headerHtml = `
    <div style="background-color:#09090b;padding:24px;text-align:center;border-bottom:1px solid #27272a;">
      <span style="font-size:24px;font-weight:bold;color:#818cf8;letter-spacing:-0.5px;">AGENCIE</span>
    </div>
  `;

  const footerHtml = `
    <div style="margin-top:32px;padding-top:16px;border-top:1px solid #27272a;font-size:12px;color:#a1a1aa;text-align:center;">
      <p>AGENCIE — Operating system for marketing and creative agencies.</p>
      <p>This is an automated operational notification regarding ${agency}.</p>
    </div>
  `;

  switch (eventType) {
    case "MemberInvited": {
      const inviteUrl = data.token
        ? buildDeepLink(frontendUrl, `login?invite=${data.token}`)
        : deepLink;
      const subject = `[AGENCIE] You're invited to join ${agency}`;
      const text = `Hi ${recipient},\n\nYou have been invited to join ${agency} on AGENCIE as a team member.\n\nAccept your invitation and join the workspace:\n${inviteUrl}\n\nAGENCIE Team`;
      const html = `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#18181b;color:#f4f4f5;border-radius:12px;overflow:hidden;padding:24px;">
          ${headerHtml}
          <div style="padding:24px;">
            <h2 style="color:#ffffff;margin-top:0;">You're invited to join ${agency}</h2>
            <p style="color:#a1a1aa;font-size:15px;line-height:1.5;">Hi ${recipient},</p>
            <p style="color:#a1a1aa;font-size:15px;line-height:1.5;">You have been invited to join <strong>${agency}</strong> on AGENCIE to collaborate on client campaigns, content workflows, and deliverables.</p>
            <div style="margin:28px 0;text-align:center;">
              <a href="${inviteUrl}" style="background-color:#6366f1;color:#ffffff;padding:12px 28px;text-decoration:none;border-radius:8px;font-weight:600;display:inline-block;">Accept Invitation</a>
            </div>
            <p style="color:#71717a;font-size:13px;">If the button above does not work, copy and paste this link into your browser:<br/><a href="${inviteUrl}" style="color:#818cf8;">${inviteUrl}</a></p>
          </div>
          ${footerHtml}
        </div>
      `;
      return { subject, html, text };
    }

    case "WorkOrderCreated":
    case "WorkOrderAssigned": {
      const subject = `[AGENCIE] Work Assigned: ${data.workName || data.title}${data.clientName ? ` — ${data.clientName}` : ""}`;
      const text = `Hi ${recipient},\n\nNew work has been assigned to you in ${agency}:\n${data.workName || data.title}\n${data.clientName ? `Client: ${data.clientName}\n` : ""}${data.dueDate ? `Due: ${data.dueDate}\n` : ""}\nOpen in AGENCIE:\n${deepLink}\n`;
      const html = `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#18181b;color:#f4f4f5;border-radius:12px;overflow:hidden;padding:24px;">
          ${headerHtml}
          <div style="padding:24px;">
            <h2 style="color:#ffffff;margin-top:0;">New Work Assigned</h2>
            <p style="color:#a1a1aa;font-size:15px;">Hi ${recipient},</p>
            <p style="color:#a1a1aa;font-size:15px;">You have a new work assignment in <strong>${agency}</strong>.</p>
            <div style="background:#27272a;padding:16px;border-radius:8px;margin:20px 0;">
              <p style="margin:4px 0;color:#ffffff;font-weight:600;">${data.workName || data.title}</p>
              ${data.clientName ? `<p style="margin:4px 0;color:#a1a1aa;font-size:14px;">Client: ${data.clientName}</p>` : ""}
              ${data.dueDate ? `<p style="margin:4px 0;color:#818cf8;font-size:14px;">Due Date: ${data.dueDate}</p>` : ""}
            </div>
            <div style="margin:28px 0;text-align:center;">
              <a href="${deepLink}" style="background-color:#6366f1;color:#ffffff;padding:12px 28px;text-decoration:none;border-radius:8px;font-weight:600;display:inline-block;">View in AGENCIE</a>
            </div>
          </div>
          ${footerHtml}
        </div>
      `;
      return { subject, html, text };
    }

    case "ContentAssigned":
    case "WorkflowTaskAssigned": {
      const subject = `[AGENCIE] Task Assigned: ${data.workName || data.title}${data.clientName ? ` — ${data.clientName}` : ""}`;
      const text = `Hi ${recipient},\n\nA content workflow task has been assigned to you in ${agency}:\n${data.workName || data.title}\n${data.stageName ? `Stage: ${data.stageName}\n` : ""}\nOpen in AGENCIE:\n${deepLink}\n`;
      const html = `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#18181b;color:#f4f4f5;border-radius:12px;overflow:hidden;padding:24px;">
          ${headerHtml}
          <div style="padding:24px;">
            <h2 style="color:#ffffff;margin-top:0;">Task Assigned</h2>
            <p style="color:#a1a1aa;font-size:15px;">Hi ${recipient},</p>
            <p style="color:#a1a1aa;font-size:15px;">A workflow task requires your action in <strong>${agency}</strong>.</p>
            <div style="background:#27272a;padding:16px;border-radius:8px;margin:20px 0;">
              <p style="margin:4px 0;color:#ffffff;font-weight:600;">${data.workName || data.title}</p>
              ${data.stageName ? `<p style="margin:4px 0;color:#a1a1aa;font-size:14px;">Stage: ${data.stageName}</p>` : ""}
              ${data.clientName ? `<p style="margin:4px 0;color:#a1a1aa;font-size:14px;">Client: ${data.clientName}</p>` : ""}
            </div>
            <div style="margin:28px 0;text-align:center;">
              <a href="${deepLink}" style="background-color:#6366f1;color:#ffffff;padding:12px 28px;text-decoration:none;border-radius:8px;font-weight:600;display:inline-block;">Open Task</a>
            </div>
          </div>
          ${footerHtml}
        </div>
      `;
      return { subject, html, text };
    }

    case "SubmissionCreated":
    case "WorkOrderSubmitted": {
      const subject = `[AGENCIE] Review Required: ${data.workName || data.title}`;
      const text = `Hi ${recipient},\n\nA submission is ready for your review in ${agency}:\n${data.workName || data.title}\n\nOpen in AGENCIE:\n${deepLink}\n`;
      const html = `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#18181b;color:#f4f4f5;border-radius:12px;overflow:hidden;padding:24px;">
          ${headerHtml}
          <div style="padding:24px;">
            <h2 style="color:#ffffff;margin-top:0;">Review Required</h2>
            <p style="color:#a1a1aa;font-size:15px;">Hi ${recipient},</p>
            <p style="color:#a1a1aa;font-size:15px;">A new submission is waiting for your review in <strong>${agency}</strong>.</p>
            <div style="background:#27272a;padding:16px;border-radius:8px;margin:20px 0;">
              <p style="margin:4px 0;color:#ffffff;font-weight:600;">${data.workName || data.title}</p>
              ${data.stageName ? `<p style="margin:4px 0;color:#a1a1aa;font-size:14px;">Stage: ${data.stageName}</p>` : ""}
            </div>
            <div style="margin:28px 0;text-align:center;">
              <a href="${deepLink}" style="background-color:#6366f1;color:#ffffff;padding:12px 28px;text-decoration:none;border-radius:8px;font-weight:600;display:inline-block;">Review Submission</a>
            </div>
          </div>
          ${footerHtml}
        </div>
      `;
      return { subject, html, text };
    }

    case "ChangesRequested":
    case "WorkOrderChangesRequested": {
      const subject = `[AGENCIE] Changes Requested: ${data.workName || data.title}`;
      const text = `Hi ${recipient},\n\nRevisions have been requested on your deliverable in ${agency}:\n${data.workName || data.title}\n\nOpen in AGENCIE to view feedback:\n${deepLink}\n`;
      const html = `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#18181b;color:#f4f4f5;border-radius:12px;overflow:hidden;padding:24px;">
          ${headerHtml}
          <div style="padding:24px;">
            <h2 style="color:#f59e0b;margin-top:0;">Changes Requested</h2>
            <p style="color:#a1a1aa;font-size:15px;">Hi ${recipient},</p>
            <p style="color:#a1a1aa;font-size:15px;">Revisions have been requested for <strong>${data.workName || data.title}</strong> in <strong>${agency}</strong>.</p>
            <div style="margin:28px 0;text-align:center;">
              <a href="${deepLink}" style="background-color:#f59e0b;color:#ffffff;padding:12px 28px;text-decoration:none;border-radius:8px;font-weight:600;display:inline-block;">View Feedback & Update</a>
            </div>
          </div>
          ${footerHtml}
        </div>
      `;
      return { subject, html, text };
    }

    case "WorkflowStageChanged": {
      const subject = `[AGENCIE] Workflow Handoff: ${data.workName || data.title}`;
      const text = `Hi ${recipient},\n\nA deliverable has transitioned stage in ${agency}:\n${data.workName || data.title}\nStage: ${data.stageName || "Next Stage"}\n\nOpen in AGENCIE:\n${deepLink}\n`;
      const html = `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#18181b;color:#f4f4f5;border-radius:12px;overflow:hidden;padding:24px;">
          ${headerHtml}
          <div style="padding:24px;">
            <h2 style="color:#ffffff;margin-top:0;">Workflow Stage Handoff</h2>
            <p style="color:#a1a1aa;font-size:15px;">Hi ${recipient},</p>
            <p style="color:#a1a1aa;font-size:15px;">A deliverable in <strong>${agency}</strong> has progressed to a new stage requiring your team's action.</p>
            <div style="background:#27272a;padding:16px;border-radius:8px;margin:20px 0;">
              <p style="margin:4px 0;color:#ffffff;font-weight:600;">${data.workName || data.title}</p>
              ${data.stageName ? `<p style="margin:4px 0;color:#818cf8;font-size:14px;">Current Stage: ${data.stageName}</p>` : ""}
            </div>
            <div style="margin:28px 0;text-align:center;">
              <a href="${deepLink}" style="background-color:#6366f1;color:#ffffff;padding:12px 28px;text-decoration:none;border-radius:8px;font-weight:600;display:inline-block;">Open Deliverable</a>
            </div>
          </div>
          ${footerHtml}
        </div>
      `;
      return { subject, html, text };
    }

    case "ActionableApproval": {
      const subject = `[AGENCIE] Action Required Post-Approval: ${data.workName || data.title}`;
      const text = `Hi ${recipient},\n\nAn approval was granted requiring your next action in ${agency}:\n${data.workName || data.title}\n\nOpen in AGENCIE:\n${deepLink}\n`;
      const html = `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#18181b;color:#f4f4f5;border-radius:12px;overflow:hidden;padding:24px;">
          ${headerHtml}
          <div style="padding:24px;">
            <h2 style="color:#10b981;margin-top:0;">Approved — Action Required</h2>
            <p style="color:#a1a1aa;font-size:15px;">Hi ${recipient},</p>
            <p style="color:#a1a1aa;font-size:15px;">An item in <strong>${agency}</strong> has been approved and requires your next step.</p>
            <div style="background:#27272a;padding:16px;border-radius:8px;margin:20px 0;">
              <p style="margin:4px 0;color:#ffffff;font-weight:600;">${data.workName || data.title}</p>
            </div>
            <div style="margin:28px 0;text-align:center;">
              <a href="${deepLink}" style="background-color:#10b981;color:#ffffff;padding:12px 28px;text-decoration:none;border-radius:8px;font-weight:600;display:inline-block;">Proceed to Next Step</a>
            </div>
          </div>
          ${footerHtml}
        </div>
      `;
      return { subject, html, text };
    }

    default: {
      const subject = `[AGENCIE] Notification: ${data.title}`;
      const text = `Hi ${recipient},\n\n${data.body || data.title} in ${agency}.\n\nOpen in AGENCIE:\n${deepLink}\n`;
      const html = `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#18181b;color:#f4f4f5;border-radius:12px;overflow:hidden;padding:24px;">
          ${headerHtml}
          <div style="padding:24px;">
            <h2 style="color:#ffffff;margin-top:0;">${data.title}</h2>
            <p style="color:#a1a1aa;font-size:15px;">Hi ${recipient},</p>
            <p style="color:#a1a1aa;font-size:15px;">${data.body || data.title}</p>
            <div style="margin:28px 0;text-align:center;">
              <a href="${deepLink}" style="background-color:#6366f1;color:#ffffff;padding:12px 28px;text-decoration:none;border-radius:8px;font-weight:600;display:inline-block;">Open AGENCIE</a>
            </div>
          </div>
          ${footerHtml}
        </div>
      `;
      return { subject, html, text };
    }
  }
}
