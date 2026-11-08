# n8n workflows: Customer Request Automation (sample project)

Two n8n workflows for a fictional online store. Demo video: https://asenabeshiktepeli.github.io/#work-request-automation

## customer-request-intake.json
n8n Form -> Code (priority, request ID, follow-up date that skips weekends) -> Asana task -> Google Calendar follow-up -> Google Sheets log (Status: Open)

## sync-completed-tasks.json
Runs every hour: reads Open rows from Google Sheets -> checks each task in Asana -> marks completed ones as Done with the completion time.

## How to use
1. In n8n: Workflows -> Import from file.
2. Connect your own Asana, Google Calendar and Google Sheets accounts.
3. Replace the placeholders: YOUR_GOOGLE_SHEET_ID, YOUR_CALENDAR_ID, YOUR_ASANA_ID.
4. The sheet needs these columns: Request ID, Submitted at, Customer name, Customer email, Order number, Request type, Details, Priority, Follow-up date, Asana task ID (plain text), Status, Completed at.

No credentials or personal data are included. All store and customer data in the demo is fictional.