# Three-minute demo script

Run it locally for the demo (`npm run dev`) so the real server is behind it. Have two browser tabs ready: one signed in as **Shayan Akbarloyshabgahi** (medical officer), one as **Flight surgeon**, with the same mission setting. Choosing a person signs in straight away (no PIN) and opens Live monitor. The live link (https://space6ix-health-monitor.vercel.app) also works, with Contact home between tabs of one browser.

## 0:00 Say this first (15 seconds)

"Everything you will see is simulated: the crew, the readings, the accounts. Real astronaut data is not public. What is real is the rules, and each one shows the paper it comes from. This is a concept demonstrator, not a medical device."

## 0:15 Live, and everyone is normal (25 seconds)

In the header, set **Scenario** to **Normal**.

- "This is the crew right now. The clock is live; heart rate, oxygen, temperature and blood pressure update every two seconds."
- Open the **Crew** dropdown: every name says Normal. "Nothing to fix."

## 0:40 A small problem: a pill fixes it (40 seconds)

Set **Scenario** to **Flagged**. The app opens Roya Alizadeh.

- "She has a slight fever, 38.3, and a headache. Cabin CO2 is low, so the air is not the cause."
- Click **See the steps**. "A non-doctor can follow this." Press **Mark as taken** on the pain reliever step. "Pain relievers are among the medicines ISS crews use most. The dose comes from the kit label."
- Point at the live temperature as it falls. In about a minute the steps say **Fixed**.

## 1:20 An emergency: Earth has to help (50 seconds)

Set **Scenario** to **Emergency**. The app opens Khamosh Mehta.

- "The neck ultrasound shows a possible blood clot, and his pulse is fast. This happened on the ISS in 2020, and doctors on Earth directed the treatment."
- In the steps, press **Send alert to Earth**. "On the way to Mars this takes 16 minutes. The demo plays one minute as one second."
- Switch to the flight surgeon tab: the alert arrives. Type a short reply and send it.
- Back in the crew tab: **Ground control is told** ticks, then the reply shows as the **second opinion**. "Earth sees only what the crew sends."

## Optional: a 90-minute blackout (40 seconds)

Use this in place of the next part if the judges care about talking to Earth. Set the mission setting to **Space station** in both tabs so the answers come back fast.

- Open **Flight surgeon**. "Sometimes there is no contact with Earth for 90 minutes. Before it starts, the crew and the flight surgeon agree the next steps." The plan is already made from Live monitor. Press **Send plan to the flight surgeon**.
- In the flight surgeon tab, type an instruction and press **Approve plan**.
- Back in the crew tab, press **Start the blackout**. "Now nothing can be sent or received. The page shows one thing: what to do now." Press **Done**, then **Skip ahead 15 min**. "If someone collapses, Emergency mode is one tap away. Everything goes in the report when contact returns."

## 2:10 The body and the handbook (30 seconds)

Scroll up and click the **Neck vein** marker. "The camera goes to the problem. It says what to do first, what the measurement is, and how to take it."
Open **Ask**, click "Am I at risk of kidney stones?". "No AI model. It only answers from the rules and the live readings, and it says so when it does not know. It works with no connection."

## 2:40 Emergency walkthrough and close (20 seconds)

Press **Emergency**, choose **Crew member collapsed**, press Space twice. "Large steps, each marked as from a published guideline or as demo wording. The run is timed and sent to Earth."

Close: "Rules instead of a prediction model is a choice: it runs on board, works offline, and every decision can be checked against its source."

## If a judge asks

- **Why no machine learning?** No public in-flight data exists to train on, and a crew far from help needs to see why a flag was raised. Rules with sources can be audited; a model cannot.
- **Is this live data?** It is a live simulation: the scenarios are invented, the rules and sources are real.
- **Is the privacy real?** Locally, yes: the server refuses requests outside your role. On board, the whole crew sees each other's health, because crewmates help each other; the flight surgeon on Earth sees only what the crew sends. On the public demo link there is no server, so roles are only for show there.
- **What would it take to be real?** Device integration, the agency's identity system, encryption, and clinical validation of every threshold.
