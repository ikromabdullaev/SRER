import { Resend } from "resend";
import { journal } from "@/config/journal";

/**
 * Outbound email (SPEC.md §8).
 *
 * **Email is a notification, never the record.** A proposal that reaches the
 * database has been received; if delivery then fails, an editor still sees it
 * in the inbox. Losing a researcher's submission because a mail provider
 * hiccuped would be the worst outcome this form can produce, so every function
 * here reports failure rather than throwing, and the caller carries on.
 *
 * Sending is disabled until `RESEND_FROM` is set, and that is a deliberate
 * gate rather than an oversight:
 *
 *  - Resend will not verify `gmail.com`, because you do not own it. Gmail's own
 *    DMARC policy would reject the mail even if it did.
 *  - `onboarding@resend.dev` only delivers to the Resend account owner, so it
 *    cannot reach the editorial address or a submitter.
 *
 * Both were confirmed against the live API rather than assumed. Once a domain
 * is verified and `RESEND_FROM` points at it, this starts working with no code
 * change.
 */

export type SendOutcome =
  | { sent: true; id: string }
  | { sent: false; reason: string };

function client(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  return key ? new Resend(key) : null;
}

function fromAddress(): string | null {
  const from = process.env.RESEND_FROM?.trim();
  return from ? from : null;
}

export function editorialAddress(): string {
  return process.env.EDITORIAL_EMAIL?.trim() || journal.adminEmail;
}

/** True when outbound mail is actually configured. */
export function emailEnabled(): boolean {
  return Boolean(client() && fromAddress());
}

async function send(options: {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
}): Promise<SendOutcome> {
  const resend = client();
  const from = fromAddress();

  if (!resend) return { sent: false, reason: "RESEND_API_KEY is not set." };
  if (!from) {
    return {
      sent: false,
      reason:
        "RESEND_FROM is not set. Verify a domain at resend.com/domains and " +
        "set RESEND_FROM to an address on it; gmail.com cannot be a sender.",
    };
  }

  try {
    const { data, error } = await resend.emails.send({
      from,
      to: [options.to],
      subject: options.subject,
      text: options.text,
      ...(options.replyTo ? { replyTo: options.replyTo } : {}),
    });

    if (error) return { sent: false, reason: error.message };
    return { sent: true, id: data?.id ?? "" };
  } catch (caught) {
    return {
      sent: false,
      reason: caught instanceof Error ? caught.message : "Unknown failure.",
    };
  }
}

export type ProposalSummary = {
  name: string;
  email: string;
  affiliation: string | null;
  title: string;
  abstract: string;
  locale: string;
  coauthorNote: string | null;
  hasAttachment: boolean;
};

/** Tells the editors a proposal arrived. */
export async function notifyEditors(
  proposal: ProposalSummary,
): Promise<SendOutcome> {
  const lines = [
    `A new proposal has been submitted to ${journal.name}.`,
    "",
    `Name:        ${proposal.name}`,
    `Email:       ${proposal.email}`,
    `Affiliation: ${proposal.affiliation ?? "—"}`,
    `Language:    ${proposal.locale}`,
    `Attachment:  ${proposal.hasAttachment ? "yes" : "no"}`,
    "",
    `Title: ${proposal.title}`,
    "",
    "Abstract:",
    proposal.abstract,
  ];

  if (proposal.coauthorNote) {
    lines.push("", "Co-authors:", proposal.coauthorNote);
  }

  lines.push(
    "",
    "Open the proposals inbox in the admin area to change its status or read",
    "the attachment. Replying to this message replies to the researcher.",
  );

  return send({
    to: editorialAddress(),
    subject: `Proposal: ${proposal.title}`,
    text: lines.join("\n"),
    // So an editor can simply hit reply.
    replyTo: proposal.email,
  });
}

/** Confirms receipt to the researcher. */
export async function confirmToSubmitter(
  proposal: ProposalSummary,
): Promise<SendOutcome> {
  const text = [
    `Dear ${proposal.name},`,
    "",
    `Thank you for your proposal to ${journal.name}. We have received it and an`,
    "editor will be in touch. There are no submission or publication fees.",
    "",
    `Title: ${proposal.title}`,
    "",
    "This is an automated confirmation; you do not need to reply.",
    "",
    journal.publisher,
  ].join("\n");

  return send({
    to: proposal.email,
    subject: `We received your proposal: ${proposal.title}`,
    text,
    replyTo: editorialAddress(),
  });
}
