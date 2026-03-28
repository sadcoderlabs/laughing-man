import type { Resend } from "resend";

export interface BroadcastSummary {
  id: string;
  name: string;
  status: string;
}

export interface CreateBroadcastParams {
  audienceId: string;
  from: string;
  replyTo?: string;
  subject: string;
  html: string;
  name: string;
}

export interface ResendProvider {
  listBroadcasts(): Promise<BroadcastSummary[]>;
  createBroadcast(params: CreateBroadcastParams): Promise<string>;
  sendBroadcast(broadcastId: string): Promise<void>;
}

export function createResendProvider(client: Resend): ResendProvider {
  return {
    async listBroadcasts(): Promise<BroadcastSummary[]> {
      const { data, error } = await client.broadcasts.list();
      if (error) throw new Error(`Resend error: ${error.message}`);
      return (data?.data ?? []) as BroadcastSummary[];
    },

    async createBroadcast(params: CreateBroadcastParams): Promise<string> {
      const { data, error } = await client.broadcasts.create({
        audienceId: params.audienceId,
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
  };
}
