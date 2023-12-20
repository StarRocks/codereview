import { ProbotOctokit } from "probot";
import { Chat } from '../../chat';
import { createAppAuth } from '@octokit/auth-app';
import { Axiom } from '@axiomhq/js';

const axiom = new Axiom({
  token: process.env.AXIOM_TOKEN || '',
  orgId: process.env.AXIOM_ORG_ID || '',
});

const authConfig = {
  appId: process.env.APP_ID || '',
  privateKey: process.env.PRIVATE_KEY || '',
  clientId: process.env.CLIENT_ID || '',
  installationId: process.env.INSTALLATION_ID,
  clientSecret: process.env.CLIENT_SECRET,
};

const MAX_RETRIES = 3;
const RETRY_DELAY = 30000;

/**
 * @param {{ method: string; body: { patch: any; repo: any; owner: any; pull_number: any; commit_id: any; filename: any; OPENAI_API_KEY: any; }; }} req
 * @param {{ status: (arg0: number) => { (): any; new (): any; end: { (): any; new (): any; }; json: { (arg0: { error?: string; message?: string; }): any; new (): any; }; }; }} res
 */
export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).end();
  }

  const {
    patch,
    repo,
    owner,
    pull_number,
    commit_id,
    filename
  } = req.body;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const chat = new Chat();
      const prompt = chat.generatePrompt(patch);
      const response = await chat.codeReview(prompt);

      if (response) {
        const octokit = new ProbotOctokit({
          authStrategy: createAppAuth,
          auth: authConfig
        });

        await octokit.pulls.createReviewComment({
          repo,
          owner,
          pull_number,
          commit_id,
          path: filename,
          body: response.text(),
          position: patch.split("\n").length - 1,
        });

        console.log(pull_number, " : ", filename, " reviewed", "model ", "genai", " prompt length: ", prompt.length, " total tokens: ", 0, "price: ", 0);

        axiom.ingest('codereview', [{ pr: pull_number, filename: filename, token: 0, price: 0, prompt: prompt, result: response.text() }]);
        await axiom.flush();

        return res.status(200).json({ message: "Review completed." });
      } else {
        console.log(pull_number, " : ", filename, " reviewResult failed");
        return res.status(500).json({ error: "Review failed." });
      }
    } catch (error: any) {
      axiom.ingest('codereview', [{ pr: pull_number, filename: filename, error: error }]);
      await axiom.flush();

      if (error.statusCode === 429 && attempt < MAX_RETRIES - 1) {
        console.error(`Rate limit error. Retrying in ${RETRY_DELAY / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      } else {
        console.error(pull_number, " : ", filename, " reviewResult error", error);
        return res.status(500).json({ error: `Error: ${error}` });
      }
    }
  }
}


