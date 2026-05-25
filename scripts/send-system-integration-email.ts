import { sendSystemIntegrationSuccessfulEmail } from "@/lib/email";

async function main() {
  const recipient = "muhamadhamo062@gmail.com";
  const result = await sendSystemIntegrationSuccessfulEmail(recipient);
  // eslint-disable-next-line no-console
  console.log(`[email:test] recipient=${recipient} result=${result}`);
  if (result !== "sent") {
    process.exitCode = 1;
  }
}

void main();
