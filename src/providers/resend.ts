import type { Resend } from "resend";

export interface SegmentSummary {
  id: string;
  name: string;
}

export interface BroadcastSummary {
  id: string;
  name: string;
  status: string;
}

export interface CreateBroadcastParams {
  segmentId: string;
  from: string;
  replyTo?: string;
  subject: string;
  html: string;
  name: string;
}

export interface SendEmailParams {
  to: string;
  from: string;
  replyTo?: string;
  subject: string;
  html: string;
}

export interface ResendProvider {
  listSegments(): Promise<SegmentSummary[]>;
  listBroadcasts(): Promise<BroadcastSummary[]>;
  createBroadcast(params: CreateBroadcastParams): Promise<string>;
  sendBroadcast(broadcastId: string): Promise<void>;
  sendEmail(params: SendEmailParams): Promise<string>;
}

export function createResendProvider(client: Resend): ResendProvider {
  return {
    async listSegments(): Promise<SegmentSummary[]> {
      const { data, error } = await client.segments.list();
      if (error) throw new Error(`Resend error: ${error.message}`);
      return (data?.data ?? []).map((s) => ({ id: s.id, name: s.name }));
    },

    async listBroadcasts(): Promise<BroadcastSummary[]> {
      const { data, error } = await client.broadcasts.list();
      if (error) throw new Error(`Resend error: ${error.message}`);
      return (data?.data ?? []) as BroadcastSummary[];
    },

    async createBroadcast(params: CreateBroadcastParams): Promise<string> {
      const { data, error } = await client.broadcasts.create({
        segmentId: params.segmentId,
        from: params.from,
        replyTo: params.replyTo,
        subject: params.subject,
        html: params.html,
        name: params.name,
      });
      if (error) throw new Error(`Resend error: ${error.message}`);
      if (!data?.id) throw new Error("Resend returned no broadcast id");
      return data.id;
    },

    async sendBroadcast(broadcastId: string): Promise<void> {
      const { error } = await client.broadcasts.send(broadcastId);
      if (error) throw new Error(`Resend error: ${error.message}`);
    },

    async sendEmail(params: SendEmailParams): Promise<string> {
      const { data, error } = await client.emails.send({
        to: params.to,
        from: params.from,
        replyTo: params.replyTo,
        subject: params.subject,
        html: params.html,
      });
      if (error) throw new Error(`Resend error: ${error.message}`);
      if (!data?.id) throw new Error("Resend returned no email id");
      return data.id;
    },
  };
}
