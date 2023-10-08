import { Probot } from 'probot';

const MAX_PATCH_COUNT = process.env.MAX_PATCH_LENGTH
  ? +process.env.MAX_PATCH_LENGTH
  : Infinity;

const REVIEW_URL = process.env.REVIEW_URL || '';

export const robot = (app: Probot) => {
  app.on('pull_request.opened',
    async (context) => {
      const repo = context.repo();

      const pull_request = context.payload.pull_request;

      if (pull_request.locked || pull_request.draft) {
        console.log('invalid event paylod');
        return 'invalid event paylod';
      }

      if (pull_request.base.ref !== 'main') {
        console.log('not main branch');
        return 'not main branch';
      }

      const data = await context.octokit.repos.compareCommits({
        owner: repo.owner,
        repo: repo.repo,
        base: context.payload.pull_request.base.sha,
        head: context.payload.pull_request.head.sha,
      });

      let { files: changedFiles, commits } = data.data;

      // if (context.payload.action === 'synchronize' && commits.length >= 2) {
      //   const {
      //     data: { files },
      //   } = await context.octokit.repos.compareCommits({
      //     owner: repo.owner,
      //     repo: repo.repo,
      //     base: commits[commits.length - 2].sha,
      //     head: commits[commits.length - 1].sha,
      //   });

      //   const filesNames = files?.map((file) => file.filename) || [];
      //   changedFiles = changedFiles?.filter(
      //     (file) =>
      //       filesNames.includes(file.filename));
      // };

      if (!changedFiles?.length) {
        console.log('no change file');
        return 'no change';
      }

      console.log("change files length ", changedFiles.length)

      changedFiles = changedFiles.sort((a, b) => {
        const aPatchLength = a.patch?.length ?? 0;
        const bPatchLength = b.patch?.length ?? 0;
        return bPatchLength - aPatchLength;
      });

      let reviewCount = 0;
      for (let i = 0; i < changedFiles.length && reviewCount < 5; i++) {
        const file = changedFiles[i];
        const patch = file.patch || '';

        if (file.status !== 'modified' && file.status !== 'added') {
          continue;
        }

        if (file.filename.includes("test") || file.filename.startsWith("docs")) {
          console.log(
            `${file.filename} skipped because test or doc file`
          );
          continue;
        }

        if (file.additions < 10) {
          console.log(
            `${file.filename} skipped because additions fewer than 10`
          );
          continue;
        }

        if (!patch || patch.length > MAX_PATCH_COUNT) {
          console.log(
            `${file.filename} skipped caused by its diff is too large ${patch.length}`
          );
          continue;
        }

        try {
          const requestBody = {
            patch: patch,
            repo: repo.repo,
            owner: repo.owner,
            pull_number: context.pullRequest().pull_number,
            commit_id: commits[commits.length - 1].sha,
            filename: file.filename,
          };

          context.octokit.request("POST " + REVIEW_URL, {
            headers: {
              "content-type": "application/json",
            },
            data: requestBody
          }).then(response => {
            console.log(i, ":", response.data);
          }).catch(error => {
            console.error("Error:", error);
          });
          reviewCount++;
        } catch (e) {
          console.error(`review ${file.filename} failed`, e);
        }
      }

      console.log('successfully reviewed', context.payload.pull_request.html_url);
      console.log('review file number', reviewCount);

      return 'success';
    }
  );
};
