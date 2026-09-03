# Submission checklist

## Repository

- Use the public GitHub repository.
- Confirm that `main` contains the final commit.
- Confirm that the README starts with the offline demo.

## Working demonstration

- Open `web/offline.html` without a server.
- Run one outcome prediction.
- Run one pitch recommendation.
- Confirm that each result shows 40,000 trials.

## Video

- Keep the video below five minutes.
- Use the 90-second script in `docs/DEMO_SCRIPT.md`.
- Run `npm run demo:record` to create a clean screen recording.
- Upload the video to a public service.
- Add the public video link to Devpost.

## Devpost fields

- Copy the text from `docs/DEVPOST.md`.
- Add the GitHub repository link.
- Add the public video link.
- Add screenshots of prediction and recommendation results.
- Select the correct team members.
- Test every public link in a private browser window.

## Final check

Run this command.

```bash
npm run verify
```

Submit only when this command passes.
