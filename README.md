# hackaton-doch-1

## Entities
### Unit
Each unit has a single commander, and possibly some HRs.

Each unit has the following attributes:
1. ID;
2. Name;
3. Parent unit (with the exception of the "top" unit);
4. Commander;
5. HRs.

### User
A user is a soldier. Every soldier has the following attributes:
1. Personal number (ID);
2. Full name;
3. Commander (with the exception of the "top" soldier);
4. Unit.

#### Roles
There are a few roles a soldier can have:
1. commander;
2. human resources (HR).

Every soldier is a soldier, and a soldier being a commander or an HR is independent. You can have four kinds of soldiers:
1. a simple soldier;
2. a commander (also a soldier), e.g. a team commander;
3. an HR (also a soldier), e.g. a soldier in the HR office;
4. an HR and a commander, e.g. the commander of the HR office.

### Attendence Report
Each day every soldier can submit an attedence report, or their commander or unit's HR can submit on their behalf.

Every attendence report has the following attributes:
1. Date;
2. Soldier ID;
3. Soldier reported status;
4. Soldier reported notes;
5. Commander reported status;
6. Commander reported notes;
7. HR reported status;
8. HR reported notes.


### "Yarok Ba'enyim" Report
This part is currently left unspecified.

## Requirements
### Soldier
Must have: As a soldier I can report my status.
Must have: As a soldier I can report my future statuses.
Must have: As a soldier I can answer "Yarok Ba'enayim."
Should have: As a soldier I get notifications when I get "Yarok Ba'enayim."
Nice to have: As a soldier I can see my past statuses.
Nice to have: As a soldier I can write to a chatbot to report my statuses.
Nice to have: As a soldier I get a notification when I need to report my status.
Nice to have: As a soldier I see when the report is frozen and becomes a status.

### Commander
Must have: As a commander I can see my soldiers' status reports.
Must have: As a commander I can change my soldiers' status reports.
Must have: As a commander I can see my soldiers' past statuses.
Must have: As a commander I can request "Yarok Ba'enayim" for all my transitive soldiers.
Must have: As a commander I can see "Yarok Ba'enayim" reports for all my transitive soldiers.
Nice to have: As a commander I can export my soldiers' past statuses as a CSV.
Nice to have: As a commander I get an AI summary of my soldiers' statuses and reports every morning and on demand.
Nice to have: Request a change to my soldiers' past statuses from the HR.

### Human Resources (HR)
Must have: As an HR I have a unit I am assigned to.
Must have: As an HR I can change the unit's soldiers' status reports.
Must have: As an HR I can change the unit's soldiers' past statuses.
Must have: As an HR I can export the unit's soldiers' past statuses as a CSV.
Nice to have: As an HR I see commanders' requests.
Nice to have: As an HR I can get an AI summary of any part of the unit's soldiers' past statuses including insights.
