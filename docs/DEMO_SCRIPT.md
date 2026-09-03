# Demonstration script

Target length: 90 seconds.

## 0:00 to 0:10 — Problem

Say: “Baseball teams have strong data and models. Coaches still need custom code to use them.”

Say: “SeamScript turns one game situation into a checked next-pitch decision.”

## 0:10 to 0:40 — Predict one call

Open `web/offline.html`.

Explain that this page needs no server or network.

Select Alex Morgan and Taylor Kim.

Keep the 1-2 count and the prior fastball.

Select `Predict outcomes`.

Test a slider low and away.

Run the simulation.

Show the six outcome chances.

Explain that they total 100%.

Point to the 40,000 trial count.

Say: “These six outcomes are separate. Together, they equal 100%.”

## 0:40 to 1:00 — Recommend a call

Change the task to `Recommend a pitch`.

Select `Swing and miss`.

Run the simulation.

Show the best pitch and target location.

Show the two other ranked calls.

Explain that the model tested only this pitcher's arsenal.

## 1:00 to 1:20 — Show the language

Point to `situation`.

Explain that it contains known pre-pitch facts.

Point to `question`.

Explain that it contains the requested output.

Point to `using`.

Explain that team defaults can select remote data and models.

## 1:20 to 1:30 — State the limits

State that the data and local model are synthetic.

State that the range covers simulation error only.

State that a production catcher review needs private call and target data.

End with: “State the game. Ask one question. Get a checked decision.”
