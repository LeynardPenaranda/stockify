import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export const runtime = "nodejs";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

function buildEmailHtml(title: string, message: string) {
  return `
  <div style="font-family:Arial;padding:30px;background:#f4f6fb">
    <div style="max-width:600px;margin:auto;background:white;border-radius:12px;padding:25px;border:1px solid #eee">
      
      <h2 style="margin:0;color:#111">Stockify Alert</h2>

      <div style="margin-top:15px;font-size:18px;font-weight:bold">
        ${title}
      </div>

      <p style="margin-top:10px;color:#444;font-size:14px">
        ${message}
      </p>

      <div style="margin-top:20px;font-size:12px;color:#888">
        This is an automated message from the Stockify Inventory System.
      </div>

    </div>
  </div>
  `;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const html = buildEmailHtml(body.title, body.message);

    await transporter.sendMail({
      from: process.env.FROM_EMAIL,
      to: process.env.OWNER_EMAIL,
      subject: `[Stockify Inventory] ${body.title}`,
      html,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false });
  }
}
