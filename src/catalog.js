// Pocket Trainer catalog: every skill, the passport checklist and the breed table.
// Plain data, shared by the web app and (through tools/gen_catalog.js) the iPhone app.
//
// Skill fields
//   track   one of TRACKS. A track with field: true counts as field work; gate: the owner confirms this once per dog before it opens
//   needs   prerequisites: "sit" = Sit at Fluent, "sit@3" = Sit at step index 3 or later,
//           "come:reliable" = a higher level; "charge" = Yes is charged
//   proof   the proofing grid after Fluent: dur [[value, label]...], dist [labels], dis [labels].
//           Index 0 is the Fluent baseline. Labels finish the sentence "...with/at <label>".
//   places  where it can be practiced (default: everywhere)
//   needs also takes "a|b" (either one) and "plates" (growth plates closed) and "sound:gun:7" (that sound ladder at step 7, no startle in the last 3 sessions)
//   rep     "outcome" for field reps judged after the fact (you can't tap Yes from 80 yards): rounds of 3, pass at 2.
//           outcomes: the three button labels, best first. startle: the third outcome means fear, so drop 2 steps and stop.
//   youngCap  the last step allowed until growth plates close (long retrieves on hard ground)
//   gear    what to bring, listed on the plan card
//   whistle shows the whistle bar on the training screen
//   proofMark  what earns a Yes once the skill is past its ladder (proofing, reviews)
//   steps   the ladder; hold: [min, max] seconds adds the hold timer; keep: true shows Keep going

const TRACKS = [
  { id: "foundations", name: "Foundations", blurb: "The core every dog needs." },
  { id: "puppy", name: "Puppy", blurb: "First weeks home: confidence, crate, gentle mouth." },
  { id: "life", name: "Life skills", blurb: "Vet, grooming, car, guests and going out." },
  { id: "field", name: "Field basics", blurb: "Whistles, the retrieve, birds and gunfire. Shared by every bird track.", goals: ["waterfowl", "upland", "flush"], field: true },
  { id: "waterfowl", name: "Waterfowl", blurb: "Ducks and geese: steadiness, marks, water, blinds.", goals: ["waterfowl"], field: true },
  { id: "upland", name: "Upland pointing", blurb: "Quail, pheasant, chukar: point, whoa, steady to wing and shot.", goals: ["upland"], field: true },
  { id: "flush", name: "Upland flushing", blurb: "Pheasant, grouse, woodcock, quail with spaniels and labs: quarter, hup, steady.", goals: ["flush"], field: true },
  { id: "hog", name: "Hog bay dog", blurb: "Find it, bay it from a distance, come off on cue. Bay work only: no catching and no contact.", goals: ["hog"], field: true,
    gate: { title: "Before hog work", text: "This track trains bay dogs only. The dog never touches a hog. Many states restrict hunting hogs with dogs, and hog-dog fights and catch events are crimes in several states. All practice here uses scent and a dummy target. Real hogs are for lawful hunting only, with an experienced mentor and a vest and GPS collar on the dog.", confirm: "I checked my state's rules. Bay work only." } },
  { id: "tracking", name: "Blood tracking", blurb: "Recover wounded deer on a long line.", goals: ["tracking"], field: true,
    gate: { title: "Before blood tracking", text: "Some states ban tracking dogs, and others need a license, a leash, or permission to track after dark or while carrying a gun. Check with your state wildlife agency every season, and get the landowner's permission.", confirm: "I checked my state's rules" } },
  { id: "shed", name: "Shed antler", blurb: "Hunt dropped antlers. Check your state's shed season.", goals: ["shed"], field: true },
  { id: "nosework", name: "Nose work", blurb: "Search boxes, rooms and cars for a scent. Any dog can do it, any age.", goals: ["nosework"] },
  { id: "sport", name: "Obedience and Canine Good Citizen", blurb: "Ready for the test, then tidier than the test asks.", goals: ["sport"], checklist: "cgc" },
  { id: "tricks", name: "Tricks and body awareness", blurb: "Fun, and the balance that prevents injuries.", goals: ["tricks"] },
];

// The sound ladder: each sound at 10 volume steps, always paired with food.
// Up a step after 2 relaxed sessions (steps 1-4) or 3 (steps 5-10); down 2 on any startle. Puppies under 16 weeks stop at step 5.
const SOUNDS = [
  { id: "doorbell", name: "Doorbell" }, { id: "traffic", name: "Traffic" }, { id: "thunder", name: "Thunder" },
  { id: "fireworks", name: "Fireworks" }, { id: "duck", name: "Duck call" }, { id: "gun", name: "Gunshot" },
];

// Season readiness: the milestone skills each opening day needs, at Fluent or better.
const SEASONS = {
  waterfowl: { name: "Waterfowl opener", milestones: ["retrieve", "gun", "steady", "marks", "waterentry", "waterdelivery", "doubles", "blindmanners"] },
  upland: { name: "Upland opener", milestones: ["birdintro", "whoa", "pointdur", "steadywing", "steadyshot", "range"] },
  flush: { name: "Flushing opener", milestones: ["quarter", "hup", "gun", "flushshot", "frange", "uplandret"] },
  tracking: { name: "Deer season", milestones: ["trackstart", "bloodline", "findend", "linehand"] },
  shed: { name: "Shed season", milestones: ["shedret", "shedsearch", "shedhunt"] },
};

const PLACES = [
  { id: "home", name: "Home" }, { id: "yard", name: "Yard" }, { id: "street", name: "Street" },
  { id: "park", name: "Park" }, { id: "field", name: "Field" }, { id: "water", name: "Water" },
];

const LEVELS = ["Learning", "Fluent", "Proofed", "Reliable", "Maintained"];

const SKILLS = [
  { id: "name", track: "foundations", name: "Name", goal: "Eyes on you when you say their name.", cue: "Their name, said once in a happy voice.", proofMark: "they look at you after their name, said once.", needs: ["charge"],
    proof: {"dis":["a quiet room","a toy on the floor","someone moving around","outside"]},
    steps: [
      { t: "Free eye contact", mark: "your dog looks at your face on their own.", setup: "Quiet room, treats ready, say nothing. Just wait.", reward: "Hand the treat at your chest so their eyes come back up to you." },
      { t: "Name, then look", mark: "they turn their head toward you after you say their name.", setup: "Wait until they glance away (not busy sniffing), say the name once.", reward: "Treat at your chest." },
      { t: "Mild distraction", mark: "they look at you after their name, with a toy on the floor nearby.", setup: "Toy or another person in the room. Say the name once. No repeats.", reward: "Treat at your chest. If they don't look in 3 s, move closer." },
      { t: "Across the room", mark: "they look or start toward you from across the room.", setup: "They're 3 to 5 m away, not busy. Name once.", reward: "Catch works here: toss the treat toward them." },
      { t: "Outside", mark: "they look at you after their name in the yard or on the sidewalk.", setup: "On leash, a quiet spot first. Name once.", reward: "Your best treats outside." },
    ]},
  { id: "touch", track: "foundations", name: "Hand target", goal: "Nose to your palm. A handy way to move them anywhere.", cue: "\"Touch\"", proofMark: "their nose hits your palm on \"Touch\".", needs: ["charge"],
    proof: {"dist":["palm beside you","palm 1 m away","palm 3 m away"],"dis":["a quiet room","a toy nearby","outside"]},
    steps: [
      { t: "Bump the palm", mark: "their nose touches your flat palm.", setup: "Hold a flat palm 5 cm from their nose. Most dogs sniff it right away.", reward: "Treat from your OTHER hand, then hide the palm behind your back and present again." },
      { t: "Move the palm", mark: "they move to bump your palm held 20 to 30 cm to the left, right, up or low.", setup: "Change the spot each rep.", reward: "Treat from the other hand." },
      { t: "Add the word", mark: "they bump your palm after you say \"Touch\".", setup: "Say \"Touch\", then present the palm. Word first, hand second.", reward: "Treat from the other hand." },
      { t: "Come to the hand", mark: "their nose hits your palm after they walk 2 or 3 steps to it.", setup: "Step away, say \"Touch\", hold the palm out.", reward: "Treat at the palm." },
      { t: "Use it for real", mark: "they touch on cue in a new room or outside.", setup: "Use Touch to move them off the couch, past a dog, or through a door.", reward: "Treat at the palm." },
    ]},
  { id: "sit", track: "foundations", name: "Sit", goal: "Rear on the floor, from a word.", cue: "\"Sit\"", proofMark: "they sit on one cue.", needs: ["charge"],
    proof: {"dist":["beside you","2 steps away","5 steps away"],"dis":["a quiet room","you moving your hands","a dropped treat","outside"]},
    steps: [
      { t: "Lure", mark: "the rear touches the floor.", setup: "Treat at their nose, move it slowly up and back over the head. The rear drops as the head goes up.", reward: "Give the lure treat while they're still sitting." },
      { t: "Empty hand", mark: "the rear touches the floor.", setup: "Same hand motion, no treat in that hand.", reward: "Treat from your other hand or pouch, delivered while they sit." },
      { t: "Small signal", mark: "the rear touches the floor after a small upward flick of your hand.", setup: "Make the motion smaller each rep, standing up straight.", reward: "Treat while they sit." },
      { t: "Add the word", mark: "the rear touches the floor.", setup: "Say \"Sit\" once, wait half a second, THEN give the hand signal.", reward: "Treat while they sit. Soon they'll sit before the signal." },
      { t: "Word only", mark: "they sit after \"Sit\" with your hands still.", setup: "Hands at your sides. If no sit in 3 seconds, go back a step.", reward: "Treat while they sit." },
      { t: "Hold the sit", mark: "they've held the sit until the timer marks it.", setup: "Ask for Sit, then start the hold. Tap Miss if they get up.", reward: "Yes is their release. Hand the treat over right away.", hold: [2,6] },
      { t: "New places", mark: "they sit on one cue in the yard, a hallway, the sidewalk.", setup: "New place = easier step. Start with the hand signal again if needed.", reward: "Treat while they sit." },
    ]},
  { id: "down", track: "foundations", name: "Down", goal: "Elbows on the floor, from a word.", cue: "\"Down\"", proofMark: "they lie down on one cue.", needs: ["sit"],
    proof: {"dist":["beside you","2 steps away","5 steps away"],"dis":["a quiet room","you moving your hands","a dropped treat","outside"]},
    steps: [
      { t: "Lure", mark: "both elbows touch the floor.", setup: "From a sit, move a treat from their nose straight down between the front paws, then slowly along the floor.", reward: "Give the treat on the floor between their paws." },
      { t: "Empty hand", mark: "both elbows touch the floor.", setup: "Same motion, no treat in that hand.", reward: "Treat from the other hand, placed between their paws." },
      { t: "Small signal", mark: "the elbows touch after you point at the floor while standing taller.", setup: "Bend less each rep.", reward: "Treat on the floor between the paws." },
      { t: "Add the word", mark: "both elbows touch the floor.", setup: "Say \"Down\" once, pause half a second, then give the signal.", reward: "Treat between the paws." },
      { t: "Word only", mark: "they lie down after \"Down\" with your hands still.", setup: "If nothing in 3 seconds, go back a step.", reward: "Treat between the paws." },
      { t: "New places", mark: "they go down on one cue somewhere new.", setup: "Soft ground first (grass, a mat). Hard floors are harder.", reward: "Treat between the paws." },
    ]},
  { id: "stay", track: "foundations", name: "Stay", goal: "Hold a sit or down until you release them.", cue: "\"Stay\". Yes is the release (or Free, to end without a treat).", proofMark: "they're still in position when the timer marks it.", needs: ["sit@3"],
    proof: {"dur":[[5,"5 s"],[10,"10 s"],[20,"20 s"],[30,"30 s"],[60,"1 minute"]],"dist":["you beside them","you 1 step away","you 3 steps away","you 5 steps away","you across the room"],"dis":["no distraction","you shifting your weight","a dropped treat","someone walking by","a toy tossed past"]},
    steps: [
      { t: "Tiny hold", mark: "they're still sitting when the timer marks it.", setup: "Ask for Sit, say \"Stay\", start the hold. Stand right in front of them.", reward: "Yes ends the stay. Treat right away; getting up after Yes is fine.", hold: [1,3] },
      { t: "Longer hold", mark: "they're still sitting when the timer marks it.", setup: "Same, but the time varies so they can't guess the end. Tap Miss if they get up.", reward: "Yes ends the stay. Treat right away.", hold: [3,10] },
      { t: "One step away", mark: "you've stepped back, returned, and they're still sitting.", setup: "Say \"Stay\", one step back, step back in. Mark when you're back beside them.", reward: "Yes ends the stay. Treat right away.", keep: true },
      { t: "Distance", mark: "you've walked 3 to 5 steps away and back and they're still sitting.", setup: "Going farther? Keep the time short.", reward: "Treat as soon as you're back beside them. Never call them out of a stay.", keep: true },
      { t: "Distraction", mark: "they hold the stay while you drop a toy, clap, or knock.", setup: "Stand close again. Distraction up = distance and time down.", reward: "Yes ends the stay. Treat right away.", hold: [3,8] },
      { t: "New places", mark: "they hold a short stay somewhere new.", setup: "Start at the Tiny hold level in each new place.", reward: "Yes ends the stay. Treat right away.", hold: [2,6] },
    ]},
  { id: "come", track: "foundations", name: "Come", goal: "Run to you every time you call.", cue: "Name + \"Come\", once. The Recall whistle is for emergencies.", proofMark: "they run all the way to you on one call.", needs: ["name"],
    proof: {"dist":["3 m","5 m","10 m","20 m","30 m"],"dis":["no distraction","toys nearby","food on the ground","another dog nearby","people playing"]},
    steps: [
      { t: "Ping-pong indoors", mark: "their front feet reach you.", setup: "2 to 3 m away. Say name + \"Come\" once, take a step backward, clap if needed.", reward: "Treat at your knees, then touch their collar." },
      { t: "Collar touch", mark: "you hold their collar and they stay with you.", setup: "Call, then gently take the collar. This keeps recall from meaning \"fun is over\".", reward: "Treat while you hold the collar, then let go." },
      { t: "Other room", mark: "they arrive from another room.", setup: "Call once from out of sight.", reward: "Two or three treats in a row. Arriving should feel great." },
      { t: "Long line", mark: "they turn and run to you in the yard or park.", setup: "5 to 10 m line, call when they're not busy sniffing.", reward: "Jackpot: several treats or a toy game." },
      { t: "Away from a sniff", mark: "they leave a smell to come to you.", setup: "Long line. If they don't turn in 3 s, go back a step. Never reel them in angry.", reward: "Jackpot, then send them back to the sniff." },
    ]},
  { id: "leave", track: "foundations", name: "Leave it", goal: "Back off whatever you point out.", cue: "\"Leave it\"", proofMark: "they leave it on one cue and look back at you.", needs: ["charge"],
    proof: {"dis":["a treat in your fist","a treat on the floor","food you drop by surprise","food you walk past","food on a walk"]},
    steps: [
      { t: "Closed fist", mark: "their nose moves away from your closed fist.", setup: "Treat in a closed fist at their nose level. Let them lick and nudge. Say nothing. Wait.", reward: "Treat from your OTHER hand. Never from the fist." },
      { t: "Open palm", mark: "they back off the treat on your open palm.", setup: "Open your palm. If they dive in, close it. Wait for them to pull back.", reward: "Treat from the other hand." },
      { t: "Add the word", mark: "they look away after \"Leave it\".", setup: "Say \"Leave it\" once as you show the fist or palm.", reward: "Treat from the other hand." },
      { t: "Floor", mark: "they look away from a treat on the floor, or look at you.", setup: "Drop a treat, foot ready to cover it. \"Leave it\" once.", reward: "Treat from your hand, never the one on the floor." },
      { t: "Walk past", mark: "they walk past a treat on the floor without lunging.", setup: "On leash, walk past at a distance they can manage, then closer.", reward: "Treat at your side as you pass." },
      { t: "Real life", mark: "they leave wrappers, food or droppings on a walk.", setup: "On leash, spot it before they do and cue early.", reward: "Your best treats." },
    ]},
  { id: "drop", track: "foundations", name: "Drop it", goal: "Let go of what's in their mouth.", cue: "\"Drop\"", proofMark: "they let go on one cue.", needs: ["charge"],
    proof: {"dis":["a so-so toy","a favorite toy","a found object"]},
    steps: [
      { t: "Trade", mark: "the toy leaves their mouth.", setup: "Play tug or fetch with a so-so toy. Put a great treat at their nose.", reward: "Give the treat, then give the toy back. Getting it back is the secret." },
      { t: "Add the word", mark: "the toy leaves their mouth after \"Drop\".", setup: "Say \"Drop\", then show the treat.", reward: "Treat, then toy back." },
      { t: "Hidden treat", mark: "they let go after \"Drop\" with no treat in sight.", setup: "Treat in your pouch or pocket.", reward: "Treat, then toy back." },
      { t: "Favorite toy", mark: "they drop their favorite toy.", setup: "Use your best food.", reward: "Treat, then toy back." },
      { t: "Found items", mark: "they drop a sock, stick or found object.", setup: "Don't chase. Calm voice, \"Drop\", show food.", reward: "Your best treat. Then swap the item for a toy." },
    ]},
  { id: "leash", track: "foundations", name: "Loose leash", goal: "Walk with a slack leash.", cue: "None needed; a slack leash is the cue.", proofMark: "the leash stays slack.", needs: ["name"],
    proof: {"dur":[[10,"10 steps"],[25,"25 steps"],[50,"50 steps"],[100,"100 steps"]],"dis":["a hallway","a quiet street","another walker","a dog across the street","a busy sidewalk"]},
    steps: [
      { t: "Standing still", mark: "the leash hangs slack, or they glance at you.", setup: "Leash on, stand in a hallway or yard. Don't move.", reward: "Treat at your pant seam on the side they walk." },
      { t: "One step", mark: "they're beside you with a slack leash after you take a step.", setup: "One step, stop. Repeat.", reward: "Treat at your seam." },
      { t: "A few steps", mark: "the leash is still slack after 2 or 3 steps.", setup: "High rate: mark often. Keep going between marks is fine.", reward: "Treat at your seam, without stopping.", keep: true },
      { t: "Tight = stop", mark: "the leash goes slack again after you stopped.", setup: "When the leash gets tight, freeze. Wait for slack, mark, then walk on.", reward: "Treat at your seam, then walk." },
      { t: "Turns", mark: "they catch up to your side after you turn around.", setup: "Turn and walk the other way, cheerfully.", reward: "Treat at your seam." },
      { t: "Sidewalk", mark: "the leash stays slack for a few steps outside.", setup: "Short walks, many marks. A sniff break (Free) is a reward too.", reward: "Treat at your seam, or Free to sniff.", keep: true },
    ]},
  { id: "mat", track: "foundations", name: "Mat and settle", goal: "Go to a mat and relax there.", cue: "\"Mat\"", proofMark: "they're still relaxed on the mat when the timer marks it.", needs: ["down"],
    proof: {"dur":[[30,"30 s"],[60,"1 minute"],[180,"3 minutes"],[300,"5 minutes"],[900,"15 minutes"]],"dis":["a quiet room","the TV on","you leaving the room","a guest arriving"]},
    steps: [
      { t: "Notice the mat", mark: "they look at or sniff the mat.", setup: "Put a towel or mat down. Wait.", reward: "Tap Catch and toss the treat onto the mat." },
      { t: "One paw", mark: "one paw touches the mat.", setup: "Wait for it. Don't lure.", reward: "Catch: toss the treat onto the mat." },
      { t: "Four paws", mark: "all four paws are on the mat.", setup: "Wait for the full step-on.", reward: "Treat on the mat, between the front paws." },
      { t: "Down on the mat", mark: "they lie down on the mat.", setup: "Cue Down if they know it, otherwise wait.", reward: "Treat between the paws on the mat." },
      { t: "Stay a while", mark: "they're still lying on the mat when the timer marks it.", setup: "Sit nearby. Tap Miss if they leave.", reward: "Yes ends it. Treat between the paws.", hold: [5,30] },
      { t: "Send to mat", mark: "they go to the mat when you say \"Mat\" from a meter away.", setup: "Say \"Mat\", point. Increase the distance slowly.", reward: "Treat on the mat." },
      { t: "Settle", mark: "they're relaxed on the mat: head down, hips rolled to one side.", setup: "Sit on the couch with a book or TV. Calm, slow pace.", reward: "Mark softly or just place a treat between the paws every 30 to 60 s. Calm is the goal.", keep: true },
    ]},

  { id: "place", track: "foundations", name: "Place", goal: "Go to a raised bed or board and stay there. The base for duck blinds, boats and calm at home.", cue: "\"Place\"", proofMark: "they're still on the board when the timer marks it.", needs: ["mat"],
    proof: {"dur":[[10,"10 s"],[30,"30 s"],[60,"1 minute"],[120,"2 minutes"],[300,"5 minutes"]],"dist":["you beside the board","you 3 steps away","you across the room","you out of sight 5 s","you out of sight 30 s"],"dis":["no distraction","you walking around","a dropped treat","a knock at the door","someone walking by"]},
    steps: [
      { t: "Two paws on", mark: "both front paws touch the board or cot.", setup: "A raised board, cot or low step. Lure toward it once, then wait for the paws.", reward: "Treat while the paws are on it." },
      { t: "Four paws on", mark: "all four paws are on the board.", setup: "Wait for the back feet to climb on. Don't lure this time.", reward: "Treat on the board, between the front paws." },
      { t: "Down on place", mark: "they lie down on the board.", setup: "Once they're on, ask for Down.", reward: "Treat between the paws, on the board." },
      { t: "Hold place", mark: "they've stayed on the board until the timer marks it.", setup: "Say \"Place\", start the hold. Tap Miss if they step off.", reward: "Yes releases them. Treat on the board.", hold: [5, 30] },
      { t: "Send to place", mark: "they go to the board when you say \"Place\" from 3 m away.", setup: "Point once. Add distance a step at a time.", reward: "Treat on the board." },
    ]},
  { id: "wait", track: "foundations", name: "Wait", goal: "Pause at doors, the car and the food bowl until released.", cue: "\"Wait\", then \"OK\" to release", proofMark: "they wait until you say \"OK\".", needs: ["sit"],
    proof: {"dur":[[1,"1 s"],[3,"3 s"],[5,"5 s"],[10,"10 s"]],"dis":["no distraction","you stepping through first","someone outside","another dog nearby"]},
    steps: [
      { t: "Door crack", mark: "they stay put as you open the door a crack.", setup: "Leash on, dog at the door. Open 5 cm. If they move toward it, close it gently.", reward: "Treat from your hand, back away from the door." },
      { t: "Door open", mark: "they stay while the door is fully open for a second.", setup: "Open it wide, count one, close it.", reward: "Treat back from the door." },
      { t: "Release word", mark: "they wait until you say \"OK\", then go through.", setup: "Open, count 3, say OK and walk through together.", reward: "Going through is the reward; add a treat on the other side." },
      { t: "Car door", mark: "they wait in the car with the door open until released.", setup: "Leash on, someone holding it the first few times.", reward: "Treat in the car, then release." },
      { t: "Food bowl", mark: "they wait while you set the bowl down, until released.", setup: "Lift the bowl back up if they dive in. Try again.", reward: "The meal is the reward." },
    ]},
  { id: "checkin", track: "foundations", name: "Check-in", goal: "Look back at you on walks without being asked.", cue: "None. Checking in is their idea.", proofMark: "they look back at you on their own.", needs: ["name"],
    proof: {"dis":["a quiet street","another walker","a dog 20 m away","a busy park"]},
    steps: [
      { t: "Any glance", mark: "they glance at your face on a walk.", setup: "Quiet street, loose leash, say nothing.", reward: "Treat at your pant seam." },
      { t: "Every 10 steps", mark: "they look back at you within 10 steps.", setup: "Walk at a normal pace. Count steps in your head.", reward: "Treat at your seam." },
      { t: "At turns", mark: "they look at you when you change direction.", setup: "Turn without a word.", reward: "Treat at your seam as they catch up." },
      { t: "Mild distraction", mark: "they check in with a dog or person 20 m away.", setup: "Keep your distance so they can still eat.", reward: "Your best treats." },
      { t: "Off leash, fenced", mark: "they come back to check in without being called.", setup: "Fenced field or yard. Stand still and wait.", reward: "Treat, then send them off to sniff again." },
    ]},
  { id: "heel", track: "foundations", name: "Heel", goal: "Walk at your left knee. For crowds, roads and the field.", cue: "\"Heel\"", proofMark: "they're still at your left knee.", needs: ["leash"],
    proof: {"dur":[[10,"10 steps"],[20,"20 steps"],[40,"40 steps"],[80,"80 steps"]],"dis":["a quiet hallway","other people","a dog 20 m away","a busy sidewalk"]},
    steps: [
      { t: "Find heel", mark: "they're at your left leg, shoulder level with your knee.", setup: "Lure them into place with your left hand.", reward: "Treat at your left seam." },
      { t: "One step", mark: "they stay at your left knee as you take one step.", setup: "Step off with your left foot.", reward: "Treat at the seam." },
      { t: "Five steps", mark: "they hold position for 5 steps.", setup: "Count out loud if it helps you.", reward: "Treat at the seam, while walking." },
      { t: "Turns", mark: "they stay in position through a right turn and a left turn.", setup: "Slow down before each turn.", reward: "Treat right after the turn." },
      { t: "Pace changes", mark: "they hold position as you slow down and speed up.", setup: "Change pace for 5 steps at a time.", reward: "Treat at the seam." },
      { t: "Off leash, fenced", mark: "they heel 20 steps off leash in a fenced area.", setup: "Start right after a good on-leash round.", reward: "Treat, then a release to play." },
    ]},
  { id: "edown", track: "foundations", name: "Emergency down", goal: "Drop on the spot from a distance. Stops a dog before a road or a hazard.", cue: "\"Down!\" said sharply, or one hand straight up", needs: ["down", "stay"],
    steps: [
      { t: "Down at your side", mark: "their elbows hit the floor within 1 second of the cue.", setup: "Standing together, cue once, sharply.", reward: "Toss the treat between their paws." },
      { t: "At 2 m", mark: "they drop 2 m away from you.", setup: "Step back first, then cue.", reward: "Walk in and treat between the paws." },
      { t: "While walking", mark: "they drop mid-stride as you walk together.", setup: "Keep walking a step after the cue the first few times.", reward: "Go back and treat between the paws." },
      { t: "At 10 m", mark: "they drop 10 m away.", setup: "Long line on. Cue once; don't repeat it.", reward: "Throw the treat to them so staying down pays." },
      { t: "Running toward you", mark: "they drop while trotting toward you.", setup: "A helper holds them, you call, then cue Down halfway.", reward: "Throw the treat to them, then call them in for a second one." },
    ]},

  { id: "crate", track: "puppy", name: "Crate love", goal: "A crate that feels like a safe bedroom.", cue: "\"Crate\"", needs: [],
    steps: [
      { t: "Treats inside", mark: "they step in to get a treat you tossed in.", setup: "Door open, treats tossed to the back.", reward: "The tossed treat; toss another while they're in." },
      { t: "Walks in", mark: "they walk in on their own.", setup: "Stand near the crate and wait.", reward: "Treat inside the crate." },
      { t: "Lies down", mark: "they lie down inside.", setup: "Just wait. No luring.", reward: "Treat between the paws." },
      { t: "Door closed", mark: "they stay calm with the door closed until the timer marks it.", setup: "Close the door, sit beside it. Start the hold.", reward: "Yes, then treat through the bars and open the door.", hold: [5, 30] },
      { t: "You leave the room", mark: "they stay calm while you step out for 30 seconds.", setup: "Give a chew first. Step out, step back.", reward: "Calm treat through the bars.", hold: [20, 60] },
      { t: "Naps", mark: "they settle and nap in the crate.", setup: "After play and potty, quiet room, door open or closed.", reward: "Mark softly and drop a treat in now and then.", keep: true },
    ]},
  { id: "mouth", track: "puppy", name: "Gentle mouth", goal: "Soft mouth on skin, and toys instead of hands.", cue: "None", needs: [],
    steps: [
      { t: "Soft mouth", mark: "their teeth touch your hand softly.", setup: "Gentle play. A hard bite means a quiet \"ouch\" and 5 seconds of stillness.", reward: "Keep playing. Play is the reward." },
      { t: "Trade to a toy", mark: "they take the toy you offer instead of your sleeve.", setup: "Keep a toy in your pocket; offer it before they grab.", reward: "Tug the toy with them for a few seconds." },
      { t: "Calm hands", mark: "they stay calm while you stroke their face.", setup: "After a walk, when they're sleepy.", reward: "Treat from your other hand." },
      { t: "Settle after play", mark: "they settle within a minute after play stops.", setup: "Stop play, sit down, say nothing.", reward: "Calm treat between the paws." },
    ]},
  { id: "handling", track: "puppy", name: "Handling", goal: "Relaxed about paws, ears, mouth and collar. Makes vet visits and grooming easy.", cue: "None", needs: [],
    steps: [
      { t: "Paw touch", mark: "you touch a paw and they stay relaxed.", setup: "Touch, let go, mark.", reward: "Treat right after the touch." },
      { t: "Ears and mouth", mark: "they stay relaxed while you lift an ear or a lip.", setup: "One second at a time.", reward: "Treat right after." },
      { t: "Collar grab", mark: "they stay relaxed when you take the collar.", setup: "Slip a finger under it from the side, not from above.", reward: "Treat while you still hold it." },
      { t: "Hold 2 seconds", mark: "they stay relaxed through a 2-second hold of any part.", setup: "Count two, let go.", reward: "Treat after letting go." },
      { t: "Towel and brush", mark: "they stay relaxed for a towel rub or a few brush strokes.", setup: "Short, gentle strokes.", reward: "Treat after each few strokes." },
      { t: "Strangers' hands", mark: "they stay relaxed when a friend handles a paw.", setup: "The friend touches; you mark and treat.", reward: "Your treat, right after the touch." },
    ]},
  { id: "alone", track: "puppy", name: "Alone time", goal: "Calm when left alone. Built up before any crying starts.", cue: "\"Back soon\"", needs: ["crate@2"],
    steps: [
      { t: "10 seconds", mark: "you come back after 10 seconds and they stayed calm.", setup: "Give a chew, step out, close the door.", reward: "A calm hello and a treat. No big greeting." },
      { t: "1 minute", mark: "they stayed calm for a minute alone.", setup: "Same setup, a minute away.", reward: "Calm treat." },
      { t: "5 minutes", mark: "they stayed calm for 5 minutes.", setup: "Film them once to check they really settle.", reward: "Calm treat." },
      { t: "15 minutes", mark: "they stayed calm for 15 minutes.", setup: "A walk or a meal first.", reward: "Calm treat." },
      { t: "30 minutes", mark: "they stayed calm for 30 minutes.", setup: "Leave the house this time.", reward: "Calm treat." },
    ]},
  { id: "hallret", track: "puppy", name: "Hallway retrieve", goal: "Bring things back. The seed of every retrieve, for sport puppies and family dogs.", cue: "Their name, then the throw", needs: [],
    steps: [
      { t: "Chase", mark: "they chase a toy rolled down the hallway.", setup: "Close the hallway doors so there's nowhere to run off to.", reward: "The chase is the reward." },
      { t: "Pick up", mark: "they pick the toy up.", setup: "A soft toy that's easy to carry.", reward: "Cheer, then the next step." },
      { t: "Come back", mark: "they turn and come toward you with it.", setup: "Sit on the floor at the closed end. Clap softly.", reward: "Praise as they come." },
      { t: "To hand", mark: "they bring it to your hand.", setup: "Hold your hand low and still.", reward: "Trade for a treat, then throw again right away." },
      { t: "Hold a moment", mark: "they hold it in front of you for a second before the trade.", setup: "Wait a beat before taking it.", reward: "Trade for a treat and throw again." },
    ]},

  { id: "chin", track: "life", name: "Chin rest", goal: "Chin on your hand while you check eyes, ears and teeth. Their way of saying \"go ahead\".", cue: "\"Chin\"", needs: ["touch"],
    steps: [
      { t: "Chin on palm", mark: "their chin rests on your open palm.", setup: "Hold your palm flat, just below their chin.", reward: "Treat from your other hand." },
      { t: "Hold a few seconds", mark: "their chin stays down until the timer marks it.", setup: "Start the hold once the chin is down.", reward: "Treat from the other hand.", hold: [3, 6] },
      { t: "On a towel", mark: "their chin rests on a folded towel on your knee.", setup: "Sit on the floor with the towel.", reward: "Treat while the chin is down." },
      { t: "While you touch an ear", mark: "their chin stays down while you lift an ear.", setup: "If the chin lifts, stop touching. That's their say.", reward: "Treat while the chin is down." },
      { t: "At the vet", mark: "the chin rest holds in the vet's lobby.", setup: "Bring the towel and great treats.", reward: "Treat while the chin is down." },
    ]},
  { id: "nails", track: "life", name: "Nail care", goal: "Calm nail trims, one nail at a time.", cue: "\"Nails\"", needs: ["chin"],
    steps: [
      { t: "Paw in hand", mark: "they let you hold a paw for 2 seconds.", setup: "Chin rest first, then lift the paw.", reward: "Treat after letting go." },
      { t: "Clipper touch", mark: "the clipper touches a nail and they stay relaxed.", setup: "Just a touch. No cutting yet.", reward: "Treat right after." },
      { t: "One nail", mark: "you trim one nail tip calmly.", setup: "A tiny tip. Stop after one.", reward: "Jackpot: several treats." },
      { t: "One paw", mark: "you trim a whole paw calmly.", setup: "Treat after each nail.", reward: "Treat per nail." },
      { t: "All paws", mark: "you trim all four paws in one sitting, calmly.", setup: "Split it over days if needed.", reward: "Treat per nail, jackpot at the end." },
    ]},
  { id: "teeth", track: "life", name: "Tooth brushing", goal: "Teeth brushed in under a minute, without a fuss.", cue: "\"Teeth\"", needs: ["chin"],
    steps: [
      { t: "Lift lip", mark: "they stay relaxed while you lift a lip.", setup: "Chin rest, then lift.", reward: "Treat after." },
      { t: "Finger on teeth", mark: "they stay relaxed with your finger on their teeth.", setup: "A dab of dog toothpaste on your finger.", reward: "Treat after." },
      { t: "Brush touch", mark: "the brush touches their teeth and they stay relaxed.", setup: "Dog toothpaste on the brush.", reward: "Treat after." },
      { t: "Front teeth", mark: "you brush the front teeth for 5 seconds.", setup: "Small circles.", reward: "Treat after." },
      { t: "All teeth", mark: "you brush all the outer surfaces.", setup: "Back teeth last.", reward: "Jackpot." },
    ]},
  { id: "vet", track: "life", name: "Vet visit", goal: "Happy visits so the real ones are easy.", cue: "None", needs: ["chin"],
    steps: [
      { t: "Parking lot", mark: "they take treats calmly in the vet's parking lot.", setup: "Just visit. Leave after a few treats.", reward: "Great treats." },
      { t: "Lobby", mark: "they take treats calmly in the lobby.", setup: "Ask the front desk; most clinics welcome happy visits.", reward: "Great treats." },
      { t: "Scale", mark: "they step on the scale.", setup: "Lure on once if needed.", reward: "Treat on the scale." },
      { t: "Exam room", mark: "they stay relaxed in the exam room.", setup: "Do a chin rest in there.", reward: "Treat on the chin rest." },
      { t: "Exam table", mark: "they stay relaxed on the exam table.", setup: "With the staff's help.", reward: "Jackpot." },
    ]},
  { id: "car", track: "life", name: "Car manners", goal: "Load up on cue, ride calmly, wait to get out.", cue: "\"Load up\"", needs: ["wait"],
    steps: [
      { t: "Hop in", mark: "they jump or step into the car on \"Load up\".", setup: "Small dogs: lift on cue. A ramp for big or older dogs.", reward: "Treat in the car." },
      { t: "Settle", mark: "they lie down in the car.", setup: "Engine off first.", reward: "Treat between the paws." },
      { t: "Short ride", mark: "they stay settled for a 5-minute ride.", setup: "A helper drives; you mark.", reward: "Treat when you park." },
      { t: "Wait to exit", mark: "they wait at the open door until released.", setup: "Leash on before the door opens.", reward: "Treat, then release." },
    ]},
  { id: "floor", track: "life", name: "Four on the floor", goal: "Greet people without jumping up.", cue: "None", needs: ["sit"],
    steps: [
      { t: "Feet down", mark: "all four paws are on the floor as you come home.", setup: "Toss treats at their feet as you walk in.", reward: "Treats on the floor." },
      { t: "Helper approaches", mark: "four paws stay down as a helper walks up.", setup: "Leash on. The helper turns away if they jump.", reward: "Treat at their feet." },
      { t: "Helper greets", mark: "paws stay down while the helper pets them.", setup: "Short petting, then the helper steps back.", reward: "Treat at their feet." },
      { t: "Stranger", mark: "paws stay down when a new person says hi.", setup: "Ask a friendly stranger to help.", reward: "Treat at their feet." },
    ]},
  { id: "doorbell", track: "life", name: "Doorbell calm", goal: "The doorbell means \"go to your mat\", not \"bark and rush\".", cue: "The bell itself", needs: ["mat"],
    steps: [
      { t: "Bell, then mat", mark: "they go to the mat after the doorbell sound.", setup: "Play a doorbell sound on another phone, then cue Mat.", reward: "Treat on the mat." },
      { t: "Stay as the door opens", mark: "they stay on the mat while you open the door.", setup: "No one there yet.", reward: "Treat on the mat." },
      { t: "Real knock", mark: "they go to the mat at a real knock.", setup: "A helper knocks outside.", reward: "Treat on the mat." },
      { t: "Guest comes in", mark: "they stay on the mat while a guest walks in.", setup: "The guest ignores them until released.", reward: "Treat on the mat, then release to say hi." },
    ]},
  { id: "public", track: "life", name: "Calm in public", goal: "Settle at a café, a park bench or a busy entrance.", cue: "\"Settle\"", needs: ["mat"], places: ["street", "park", "field"],
    steps: [
      { t: "Quiet park", mark: "they settle on their mat at a quiet park.", setup: "Bring the mat and a chew.", reward: "Calm treat between the paws." },
      { t: "Patio", mark: "they settle at an outdoor café table.", setup: "A quiet time of day.", reward: "Calm treat between the paws." },
      { t: "Store entrance", mark: "they settle near a busy entrance.", setup: "Stand back from the doors.", reward: "Calm treat." },
      { t: "15 minutes", mark: "they stay settled for 15 minutes.", setup: "Mark calm moments every minute or so.", reward: "Calm treats.", keep: true },
    ]},
  { id: "dogmeet", track: "life", name: "Polite dog meetings", goal: "Pass other dogs calmly, and greet only when invited.", cue: "\"Say hi\" and \"Let's go\"", needs: ["checkin"], places: ["street", "park", "field"],
    steps: [
      { t: "Parallel at 15 m", mark: "they walk calmly with another dog 15 m away.", setup: "A friend's calm dog, walking the same direction.", reward: "Treat at your seam." },
      { t: "10 m", mark: "they walk calmly at 10 m.", setup: "Close the gap slowly.", reward: "Treat at your seam." },
      { t: "5 m", mark: "they walk calmly at 5 m.", setup: "Keep leashes loose.", reward: "Treat at your seam." },
      { t: "Brief sniff", mark: "they sniff for 3 seconds and come away on \"Let's go\".", setup: "Count three, cue, walk off.", reward: "Treat as they follow you." },
    ]},

  // ---------- Field basics: shared by Waterfowl and Upland ----------
  { id: "whistle", track: "field", name: "Whistle signals", goal: "Sit, come and turn on the whistle, so you can steer a dog 100 yards out.", cue: "One blast = sit · a trill = come · two pips = turn", proofMark: "they answer the whistle the moment it sounds.", needs: ["sit", "come@1"], whistle: true, gear: ["a whistle (or the app's)"],
    proof: {"dist":["5 m","20 m","40 m","75 m","100 m"],"dis":["no distraction","a thrown bumper","another dog","birds around"]},
    steps: [
      { t: "Sit blast at your side", mark: "they sit as the single blast ends.", setup: "Dog beside you. One blast (tap Sit on the whistle bar), then your usual sit cue. Soon the blast alone means sit.", reward: "Treat while they sit." },
      { t: "Sit blast alone", mark: "they sit on the blast with no other cue.", setup: "Blast only. If no sit in 2 seconds, help with your hand signal.", reward: "Treat while they sit." },
      { t: "Recall trill", mark: "they turn and run in on the trill.", setup: "Start at 5 m in the house or yard. Trill once, back up a step.", reward: "Treat at your knees, then a second one." },
      { t: "Turn pips", mark: "they turn toward you on two pips while trotting ahead.", setup: "On a walk when they're 5 to 10 m ahead. Change direction as you pip.", reward: "Treat as they reach you, then send them on." },
      { t: "Sit at 20 m", mark: "they sit on the blast 20 m away.", setup: "Long line on. One blast; never repeat it.", reward: "Walk out and treat while they sit, or toss it to them." },
    ]},
  { id: "retrieve", track: "field", name: "Retrieve", goal: "Chase, pick up, carry back and deliver to hand. Taught with rewards; no force fetch.", cue: "Their name sends them; \"Give\" for the delivery", proofMark: "they bring it straight back and deliver to hand.", needs: ["hallret|drop"], gear: ["bumpers"],
    steps: [
      { t: "Chase and pick up", mark: "they pick up a bumper tossed 3 m away.", setup: "A soft canvas or plastic bumper. A short, exciting toss down a hallway or narrow yard.", reward: "Cheer. The next steps pay with food." },
      { t: "Come back", mark: "they turn back toward you carrying it.", setup: "Turn and jog away a few steps to draw them in.", reward: "Praise as they come." },
      { t: "Hold 2 seconds", mark: "they hold the bumper calmly in front of you until the timer marks it.", setup: "Hand under their chin, no pulling. Start the hold.", reward: "Trade for a treat.", hold: [1, 3] },
      { t: "Hold while you walk", mark: "they carry it beside you for 10 steps.", setup: "Walk slowly with your hand near the bumper.", reward: "Trade for a treat." },
      { t: "Deliver to hand", mark: "they put the bumper in your hand.", setup: "Stand still, hand open at chest height. Say \"Give\".", reward: "Trade for a treat, then throw again right away." },
      { t: "Sent on their name", mark: "they wait for their name, then go.", setup: "Hold the collar lightly, toss, count two, say their name.", reward: "The retrieve is the reward; treat on delivery." },
    ]},
  { id: "birds", track: "field", name: "Bumper and bird intro", goal: "Happy to carry bumpers, wings and birds.", cue: "Their name", proofMark: "they carry it back gently and deliver to hand.", needs: ["retrieve@2"], gear: ["bumpers", "a duck or pigeon wing"],
    steps: [
      { t: "Soft bumper", mark: "they pick up and carry a soft bumper.", setup: "Short, fun tosses.", reward: "Treat on delivery." },
      { t: "Hard bumper", mark: "they carry a plastic or canvas bumper back.", setup: "Same short tosses.", reward: "Treat on delivery." },
      { t: "Wing on a bumper", mark: "they retrieve a bumper with a wing taped on.", setup: "A fresh or frozen wing, taped on with electrical tape.", reward: "Treat on delivery." },
      { t: "Thawed bird", mark: "they pick up and carry a thawed duck or pigeon.", setup: "Short, easy tosses. A cold bird is less tempting to chew.", reward: "Treat on delivery." },
      { t: "Fresh bird, with a mentor", mark: "they retrieve a freshly shot bird calmly.", setup: "With an experienced trainer or hunting mentor, following your state's rules on birds.", reward: "Big praise and a treat on delivery." },
    ]},
  { id: "gun", track: "field", name: "Gun conditioning", goal: "Gunfire means the fun is happening. Always far away first, and never at a nervous dog.", cue: "None", needs: ["retrieve@4", "sound:gun:7"], rep: "outcome", outcomes: ["Happy", "Noticed it", "Worried"], startle: true, places: ["yard", "park", "field"], gear: ["a helper with a blank pistol"],
    steps: [
      { t: "Blank at 100 yd", mark: "they keep chasing the bumper happily as the shot goes off 100 yards away.", setup: "A helper 100 yd off with a blank pistol. They fire the moment your dog is chasing a thrown bumper.", reward: "The retrieve, plus a treat on delivery." },
      { t: "Blank at 50 yd", mark: "they stay happy with the shot 50 yards away.", setup: "Same setup. Only move closer after happy sessions.", reward: "The retrieve, plus a treat." },
      { t: "Blank at 30 yd", mark: "they stay happy with the shot 30 yards away.", setup: "Same setup.", reward: "The retrieve, plus a treat." },
      { t: "Blank at 20 yd", mark: "they stay happy with the shot 20 yards away.", setup: "Same setup.", reward: "The retrieve, plus a treat." },
      { t: "Shotgun at 75 yd", mark: "they stay happy with a shotgun fired 75 yards away during a retrieve.", setup: "A safe range, ear protection for people, the helper far off.", reward: "The retrieve, plus a treat." },
      { t: "Your shot", mark: "they stay happy when you fire beside them.", setup: "Only after several happy sessions at every step. Gun pointed well away.", reward: "A bird or bumper to retrieve." },
    ]},

  // ---------- Waterfowl ----------
  { id: "steady", track: "waterfowl", name: "Steadiness", goal: "Sit still while things fall and fly, until sent by name.", cue: "Sit, then their name to send", proofMark: "they stay sitting until you say their name.", needs: ["stay:proofed", "retrieve"], gear: ["bumpers"],
    steps: [
      { t: "Dropped bumper", mark: "they stay sitting while you drop a bumper at your feet.", setup: "Leash on, your foot on the leash. Drop it, wait 2 seconds, mark.", reward: "Treat to them while they sit. Then pick it up yourself, or send them." },
      { t: "Tossed bumper", mark: "they stay sitting as you toss a bumper 3 m.", setup: "Send them only every other time; you pick up the rest. Staying has to pay too.", reward: "Treat while they sit." },
      { t: "Thrown 20 yd", mark: "they stay sitting through a 20-yard throw.", setup: "Same: send only some of the time.", reward: "Treat, or the retrieve." },
      { t: "Throw and shot", mark: "they stay sitting through a throw with a shot.", setup: "A helper fires a blank as you throw. Only after Gun conditioning step 3.", reward: "The retrieve." },
      { t: "Two throws", mark: "they stay sitting through two throws.", setup: "Throws wide apart.", reward: "The retrieve." },
      { t: "Honoring", mark: "they stay sitting while another dog retrieves.", setup: "A calm partner dog 3 m to the side.", reward: "Treat while they sit, then their own turn." },
    ]},
  { id: "marks", track: "waterfowl", name: "Single marks", goal: "Watch a bird fall and go straight to it.", cue: "Their name", proofMark: "a clean pickup and straight return.", needs: ["retrieve", "steady@2"], rep: "outcome", youngCap: 2, places: ["yard", "park", "field"], gear: ["bumpers", "a helper to throw"],
    steps: [
      { t: "10 yd, short grass", mark: "a clean pickup and return on a 10-yard mark.", setup: "A helper throws with a shout or duck call so the dog looks. Send on their name after it lands.", reward: "Treat on delivery." },
      { t: "25 yd", mark: "a clean retrieve on a 25-yard mark.", setup: "Short grass, wind at your back.", reward: "Treat on delivery." },
      { t: "50 yd", mark: "a clean retrieve on a 50-yard mark.", setup: "White bumpers show up best.", reward: "Treat on delivery." },
      { t: "75 yd", mark: "a clean retrieve on a 75-yard mark.", setup: "Use the distance tracker to check it.", reward: "Treat on delivery." },
      { t: "100 yd", mark: "a clean retrieve on a 100-yard mark.", setup: "A helper with a duck call or launcher.", reward: "Treat on delivery." },
      { t: "In cover", mark: "a clean retrieve from tall grass or cattails at 50 yards.", setup: "Shorter again in new cover.", reward: "Treat on delivery." },
      { t: "Ditch and wind", mark: "a clean retrieve across a ditch or into the wind.", setup: "The dog should cross, not run around.", reward: "Treat on delivery." },
    ]},
  { id: "waterentry", track: "waterfowl", name: "Water entry", goal: "Into the water with confidence, straight to the bird.", cue: "Their name", proofMark: "a straight, confident entry and swim to the bumper.", needs: ["retrieve"], rep: "outcome", places: ["water"], gear: ["bumpers", "a dog-safe pond or lake"],
    steps: [
      { t: "Wade and play", mark: "they wade in on their own to chest depth.", setup: "Warm water and a gentle bank. Wade in yourself. In cold water keep it short and dry them off after.", reward: "Treats and play in the shallows." },
      { t: "Swim 2 m", mark: "they swim a few strokes to a bumper.", setup: "Toss it just past their depth.", reward: "Treat on delivery." },
      { t: "Water mark 10 yd", mark: "a clean 10-yard water retrieve.", setup: "Throw parallel to the shore at first.", reward: "Treat on delivery." },
      { t: "25 yd", mark: "a clean 25-yard water retrieve.", setup: "Straight out from the shore.", reward: "Treat on delivery." },
      { t: "50 yd", mark: "a clean 50-yard water retrieve.", setup: "Calm water, no wind.", reward: "Treat on delivery." },
      { t: "Angled entry", mark: "they go straight in at an angle instead of running the bank.", setup: "Throw at a 45 degree angle to the shore.", reward: "Treat on delivery." },
      { t: "Among decoys", mark: "they swim past decoys to the bumper and leave the decoys alone.", setup: "Three decoys first, wide apart.", reward: "Treat on delivery." },
    ]},
  { id: "waterdelivery", track: "waterfowl", name: "Water delivery", goal: "Out of the water and straight to hand before shaking.", cue: "\"Give\"", proofMark: "they come straight out and deliver before shaking.", needs: ["waterentry@2", "retrieve"], rep: "outcome", places: ["water"], gear: ["bumpers"],
    steps: [
      { t: "Out with it", mark: "they carry the bumper out of the water without dropping it.", setup: "Stand at the water's edge.", reward: "Treat on delivery." },
      { t: "Straight to you", mark: "they come straight to you instead of shaking first.", setup: "Back up 2 m from the edge.", reward: "Treat on delivery." },
      { t: "Deliver, then shake", mark: "they deliver to hand from 5 m back, then shake.", setup: "Back up 5 m. Take the bumper before the shake.", reward: "Treat, then \"shake\" is allowed." },
    ]},
  { id: "doubles", track: "waterfowl", name: "Doubles", goal: "Remember two falls and pick up both.", cue: "Their name, then a hand line to the memory bird", proofMark: "both birds picked up cleanly, last first.", needs: ["marks@2", "steady"], rep: "outcome", youngCap: 2, places: ["yard", "park", "field", "water"], gear: ["bumpers", "a helper"],
    steps: [
      { t: "Wide apart", mark: "they pick up the last throw, then go back for the first.", setup: "Two throws 90 degrees apart at 25 yd. After the first delivery, line them up on the memory bird.", reward: "Treat on each delivery." },
      { t: "Memory bird", mark: "they remember the first bird after delivering the second.", setup: "Same, with a pause before the second send.", reward: "Treat on each delivery." },
      { t: "Tighter angles", mark: "they pick up both with the throws 45 degrees apart.", setup: "Keep the distance at 25 yd.", reward: "Treat on each delivery." },
      { t: "Land and water", mark: "they pick up one bird on land and one in water.", setup: "Water bird last thrown.", reward: "Treat on each delivery." },
      { t: "50 yd", mark: "they pick up both at 50 yards.", setup: "Wide angles again at the new distance.", reward: "Treat on each delivery." },
    ]},
  { id: "lining", track: "waterfowl", name: "Lining", goal: "Run straight where you point, toward a bird they didn't see fall.", cue: "\"Back\"", proofMark: "a straight line to the bumper.", needs: ["marks@2"], rep: "outcome", places: ["yard", "park", "field"], gear: ["white bumpers"],
    steps: [
      { t: "Pile at 10 yd", mark: "they run straight to a visible pile of bumpers on \"Back\".", setup: "Dog at your left, your hand flat beside their head pointing at the pile.", reward: "Treat on delivery." },
      { t: "Pile at 25 yd", mark: "they run straight to the pile at 25 yards.", setup: "Same.", reward: "Treat on delivery." },
      { t: "Pile at 50 yd", mark: "they run straight to the pile at 50 yards.", setup: "Same.", reward: "Treat on delivery." },
      { t: "Single bumper at 50 yd", mark: "they run straight to a single bumper they watched you place.", setup: "Walk out with them, place it, walk back.", reward: "Treat on delivery." },
      { t: "Cold blind at 75 yd", mark: "they run straight to a bumper they didn't see placed.", setup: "Plant it before the session.", reward: "Treat on delivery." },
    ]},
  { id: "casts", track: "waterfowl", name: "Handling casts", goal: "Stop on the whistle and go where your arm sends them.", cue: "One blast = stop; arm signals \"Over\" and \"Back\"", proofMark: "a stop on the whistle and the right cast.", needs: ["lining", "whistle"], rep: "outcome", whistle: true, places: ["yard", "park", "field"], gear: ["white bumpers", "a whistle"],
    steps: [
      { t: "Stop at 10 yd", mark: "they stop and sit facing you on the whistle, 10 yards out.", setup: "Send to a pile; blast halfway.", reward: "Walk out and treat, then send them on." },
      { t: "Over", mark: "they go left or right to the bumper you point to.", setup: "Dog sitting on a mound, bumpers to each side.", reward: "Treat on delivery." },
      { t: "Back", mark: "they turn and go straight back on \"Back\".", setup: "Bumpers behind them.", reward: "Treat on delivery." },
      { t: "Diamond at 30 yd", mark: "they take a correct cast 30 yards out.", setup: "The baseball-diamond drill: piles at first, second and third base.", reward: "Treat on delivery." },
      { t: "At 50 yd", mark: "they stop and take a correct cast 50 yards out.", setup: "Same drill, bigger diamond.", reward: "Treat on delivery." },
    ]},
  { id: "blinds", track: "waterfowl", name: "Blind retrieves", goal: "Find a bird they never saw fall, guided by you.", cue: "\"Back\", the whistle and casts", proofMark: "the bird found with a clean line or a handle or two.", needs: ["lining", "casts"], rep: "outcome", youngCap: 1, places: ["park", "field", "water"], gear: ["bumpers or birds"],
    steps: [
      { t: "Cold blind 25 yd", mark: "a clean pickup on a 25-yard blind.", setup: "Plant the bumper before you bring the dog out.", reward: "Treat on delivery." },
      { t: "50 yd", mark: "a clean 50-yard blind.", setup: "Clear terrain.", reward: "Treat on delivery." },
      { t: "100 yd", mark: "a 100-yard blind with a straight line or one handle.", setup: "Use the distance tracker.", reward: "Treat on delivery." },
      { t: "With a handle", mark: "they take one stop and cast and find it.", setup: "Plant it slightly off a natural line.", reward: "Treat on delivery." },
      { t: "Across water", mark: "a blind across a pond or channel.", setup: "Short water first.", reward: "Treat on delivery." },
    ]},
  { id: "huntdead", track: "waterfowl", name: "Hunt dead", goal: "Search an area for a crippled bird and bring it back.", cue: "\"Dead bird\"", proofMark: "they search the area and bring back the hidden bird.", needs: ["retrieve"], rep: "outcome", places: ["yard", "park", "field"], gear: ["bumpers or a bird"],
    steps: [
      { t: "Short cover", mark: "they search on \"Dead bird\" and find a hidden bumper in short grass.", setup: "Hide it 5 m away; let them watch you walk out.", reward: "Treat on delivery." },
      { t: "Tall cover", mark: "they find it in tall grass or brush.", setup: "Hide it before you bring them.", reward: "Treat on delivery." },
      { t: "After a wait", mark: "they find a hidden duck after a 2-minute wait.", setup: "The scent has time to spread; send them downwind.", reward: "Treat on delivery." },
    ]},
  { id: "blindmanners", track: "waterfowl", name: "Blind and boat manners", goal: "Still and quiet in a blind or boat while calls blow and guns move.", cue: "\"Place\"", proofMark: "they stay still and quiet on their spot.", needs: ["place:proofed"], places: ["yard", "field", "water"], gear: ["a dog stand or board", "decoys"],
    steps: [
      { t: "Dog stand", mark: "they hold place on a dog stand or in a boat on land until the timer marks it.", setup: "The stand on flat ground first.", reward: "Treat on the stand.", hold: [10, 60] },
      { t: "Through duck calls", mark: "they stay put while a duck call blows.", setup: "Blow a call, or play the Duck call from the sound ladder.", reward: "Treat on the stand.", keep: true },
      { t: "Through motion", mark: "they stay put while you stand, sit and shoulder an empty gun.", setup: "Slow movements first.", reward: "Treat on the stand.", keep: true },
      { t: "In a blind", mark: "they stay quiet and still in a blind for 10 minutes.", setup: "A practice blind or a layout spot.", reward: "Calm treats now and then.", keep: true },
      { t: "Decoys ignored", mark: "they walk past decoys without picking them up.", setup: "On leash, then off.", reward: "Treat as they pass." },
    ]},

  // ---------- Upland pointing ----------
  { id: "birdintro", track: "upland", name: "Bird intro and sight point", goal: "Love birds, and freeze at the sight of one.", cue: "None", proofMark: "they freeze and hold on the bird.", needs: ["charge"], places: ["home", "yard", "park", "field"], gear: ["a flirt pole", "a wing"],
    steps: [
      { t: "Chase the wing", mark: "they chase a wing on a flirt pole.", setup: "A wing tied to a flirt pole line. Drag it in circles; let them chase, not catch.", reward: "Let them catch it now and then: the catch is the reward." },
      { t: "Freeze when it stops", mark: "they freeze, staring, when the wing stops.", setup: "Stop the wing dead in the grass and wait.", reward: "Flick the wing away so they can chase again." },
      { t: "Hold 3 seconds", mark: "they hold the freeze until the timer marks it.", setup: "Stop the wing, start the hold.", reward: "Release them to chase the wing.", hold: [3, 4] },
      { t: "Hold 10 seconds", mark: "they hold the freeze until the timer marks it.", setup: "Same.", reward: "Release them to chase the wing.", hold: [8, 12] },
      { t: "Launcher pigeon, with a mentor", mark: "they point a pigeon in a launcher.", setup: "With an experienced trainer, check cord on. Release the bird only while they hold.", reward: "The flight is the reward." },
      { t: "Call-back quail", mark: "they point a quail from a call-back pen.", setup: "With a mentor or at a preserve.", reward: "The flight is the reward." },
    ]},
  { id: "whoa", track: "upland", name: "Whoa", goal: "Stop and stand still on one word, taught with rewards on a board.", cue: "\"Whoa\" (stand still; not sit)", proofMark: "they stand still on \"Whoa\" until released.", needs: ["stay"], gear: ["a low board or table", "a check cord"],
    proof: {"dur":[[3,"3 s"],[10,"10 s"],[30,"30 s"]],"dist":["you beside them","10 m","30 m"],"dis":["no distraction","a dropped bumper","a wing on the ground","a bird in a launcher"]},
    steps: [
      { t: "Stand on a board", mark: "they stand still on a raised board.", setup: "A low table or board. Lift them on, a hand under the belly at first.", reward: "Treat to the mouth while they stand." },
      { t: "Whoa on the board", mark: "they stay standing on \"Whoa\" until the timer marks it.", setup: "Say \"Whoa\", start the hold. Tap Miss if they sit or step.", reward: "Treat while they stand, then release.", hold: [2, 5] },
      { t: "Off the board", mark: "they stand still on \"Whoa\" on the ground.", setup: "Right beside the board at first.", reward: "Treat while they stand." },
      { t: "While walking", mark: "they stop and stand when you say \"Whoa\" mid-walk.", setup: "Slow walk, leash loose.", reward: "Treat while they stand." },
      { t: "At 10 m", mark: "they stop and stand on \"Whoa\" 10 m ahead of you.", setup: "Check cord on.", reward: "Walk up and treat while they stand." },
      { t: "At 30 m", mark: "they stop and stand on \"Whoa\" 30 m ahead.", setup: "Check cord on.", reward: "Walk up and treat while they stand." },
    ]},
  { id: "pointdur", track: "upland", name: "Point duration", goal: "Hold point while you walk in to flush.", cue: "None, or \"Whoa\" as a reminder", proofMark: "they hold point until released.", needs: ["birdintro@2", "whoa@2"], places: ["yard", "park", "field"], gear: ["a wing or a bird in a launcher"],
    steps: [
      { t: "Hold 3 seconds", mark: "they hold point until the timer marks it.", setup: "Wing on a pole, or a planted bird with a mentor.", reward: "Release to the wing or the flush.", hold: [3, 4] },
      { t: "Hold 10 seconds", mark: "they hold point until the timer marks it.", setup: "Same.", reward: "Release to the wing or the flush.", hold: [8, 12] },
      { t: "Hold 30 seconds", mark: "they hold point until the timer marks it.", setup: "Same.", reward: "Release to the wing or the flush.", hold: [25, 35], keep: true },
      { t: "You walk in front", mark: "they hold point while you walk past their nose.", setup: "Walk a wide arc first, then closer.", reward: "Release to the flush.", keep: true },
      { t: "You kick the cover", mark: "they hold point while you kick the grass for the bird.", setup: "Kick around the bird for a few seconds.", reward: "Release to the flush.", keep: true },
    ]},
  { id: "steadywing", track: "upland", name: "Steady to wing", goal: "Stay on point while the bird flies.", cue: "\"Whoa\" if needed", proofMark: "they stay put as the bird flies.", needs: ["pointdur@2"], rep: "outcome", outcomes: ["Steady", "Crept", "Broke"], places: ["yard", "field"], gear: ["a bird launcher", "a check cord"],
    steps: [
      { t: "Launcher at 10 yd", mark: "they hold point while the launcher fires.", setup: "Check cord on. A helper fires the launcher on your nod.", reward: "Release to hunt on or to a retrieve." },
      { t: "Bird flies off", mark: "they hold as a bird flies away.", setup: "Same, with a live bird and a mentor.", reward: "Release to hunt on." },
      { t: "Two flushes", mark: "they stay steady through two flushes in a row.", setup: "Two launchers.", reward: "Release to hunt on." },
    ]},
  { id: "steadyshot", track: "upland", name: "Steady to shot", goal: "Stay on point through the flush and the shot.", cue: "\"Whoa\" if needed", proofMark: "they stay put through the flush and the shot.", needs: ["steadywing", "gun@2"], rep: "outcome", outcomes: ["Steady", "Crept", "Broke"], places: ["field"], gear: ["a launcher", "a blank pistol", "a helper"],
    steps: [
      { t: "Blank at 30 yd", mark: "they stay steady through the flush and a blank 30 yards away.", setup: "A helper fires as the bird lifts.", reward: "Release to hunt on." },
      { t: "Blank at 10 yd", mark: "they stay steady with the blank 10 yards away.", setup: "Same.", reward: "Release to hunt on." },
      { t: "Your shot", mark: "they stay steady when you shoot.", setup: "Safe direction, the dog well behind your line of fire.", reward: "Release to the retrieve or to hunt on." },
    ]},
  { id: "steadyfall", track: "upland", name: "Steady to fall", goal: "Hold until the bird is down and you send them.", cue: "Their name to send", proofMark: "they hold through the fall and go only on their name.", needs: ["steadyshot"], rep: "outcome", outcomes: ["Steady", "Crept", "Broke"], places: ["field"], gear: ["birds", "a helper"],
    steps: [
      { t: "Hold through the fall", mark: "they hold until the bird is down and you send them.", setup: "A helper shoots; you stay near the dog.", reward: "The retrieve." },
      { t: "Released by name", mark: "they go only on their name, to retrieve or to hunt on.", setup: "Vary it: sometimes send, sometimes pick up the bird yourself.", reward: "The retrieve, or hunting on." },
    ]},
  { id: "backing", track: "upland", name: "Backing", goal: "Stop and honor another dog's point.", cue: "\"Whoa\" if needed", proofMark: "they stop on sight of the pointing dog.", needs: ["whoa"], rep: "outcome", outcomes: ["Backed", "Slowed", "Ran past"], places: ["yard", "park", "field"], gear: ["a cardboard pointing-dog cutout"],
    steps: [
      { t: "Cardboard dog", mark: "they stop on sight of a cardboard pointing dog 10 m away.", setup: "Stand the cutout in short grass; walk them up to it.", reward: "Treat while they stand." },
      { t: "Statue in cover", mark: "they stop when they come on a dog decoy in cover.", setup: "Hide it so they find it suddenly.", reward: "Treat while they stand." },
      { t: "Real dog at 20 m", mark: "they stop on a real pointing dog 20 m away.", setup: "A steady partner dog on a planted bird.", reward: "Treat while they stand." },
      { t: "Real dog at 50 m", mark: "they stop on a real pointing dog 50 m away.", setup: "Same, bigger field.", reward: "Walk up and treat." },
    ]},
  { id: "covey", track: "upland", name: "Covey and singles", goal: "Handle a covey rise and work the scattered singles.", cue: "None", proofMark: "a covey pointed and singles worked slowly.", needs: ["steadywing"], rep: "outcome", outcomes: ["Clean", "Needed help", "Bumped birds"], places: ["field"], gear: ["quail (call-back pen or preserve)"],
    steps: [
      { t: "Point the covey", mark: "they point a covey find and hold.", setup: "A preserve or call-back pen, with a mentor.", reward: "Release after the rise." },
      { t: "Through the covey rise", mark: "they stay steady as the covey flushes.", setup: "Check cord on.", reward: "Release to the singles." },
      { t: "Hunt the singles", mark: "they work slowly and point scattered singles.", setup: "Head where the birds landed.", reward: "Release after each flush." },
    ]},
  { id: "range", track: "upland", name: "Range and handling", goal: "Hunt out front at gun range and turn on the whistle.", cue: "Two pips = turn; trill = come", proofMark: "they hunt in range and answer the whistle.", needs: ["come:reliable", "whistle"], rep: "outcome", whistle: true, places: ["park", "field"], gear: ["a whistle", "a long line or GPS collar"],
    steps: [
      { t: "Check in at 50 yd", mark: "they swing back to check in within 50 yards.", setup: "Open field. Walk with the wind in your face.", reward: "Treat when they check in, then send them on." },
      { t: "Turn on the whistle", mark: "they turn on two pips from 50 yards or more.", setup: "Pip as you change direction.", reward: "Treat when they reach you, sometimes." },
      { t: "Recall from 100 yd", mark: "they come in on the trill from 100 yards in cover.", setup: "Use the distance tracker to check the range.", reward: "Jackpot." },
    ]},

  // ---------- Upland flushing ----------
  { id: "quarter", track: "flush", name: "Quartering", goal: "Zigzag in front of you inside gun range.", cue: "\"Hunt\" to start; two pips = turn", proofMark: "they cross in front of you inside 25 yards and turn on the pips.", needs: ["checkin", "whistle"], rep: "outcome", whistle: true, places: ["yard", "park", "field"], gear: ["a whistle", "treats to hide"],
    steps: [
      { t: "Zigzag to hidden treats", mark: "they cross from one hidden treat to the next as you walk a zigzag.", setup: "Hide 6 treats in the grass, 3 m left and right of your line. Walk toward each one; they find it.", reward: "The treats they find." },
      { t: "Turn on two pips", mark: "they turn and cross back on two pips.", setup: "Pip just before they reach the edge of the zigzag, and turn your body the other way.", reward: "A treat tossed ahead on the new side." },
      { t: "Field within 25 yd", mark: "they work side to side and stay inside 25 yards.", setup: "Short cover. Walk slowly, pip at 20 yards.", reward: "A bumper tossed ahead now and then." },
      { t: "Into the wind", mark: "they quarter into the wind for a full minute.", setup: "Wind in your face. Plant a wing or a scented bumper every 30 yards.", reward: "The find, then a short retrieve." },
      { t: "Crosswind", mark: "they keep the pattern with the wind from the side.", setup: "Same, with the wind on your cheek.", reward: "The find, then a short retrieve." },
    ]},
  { id: "hup", track: "flush", name: "Hup to flush", goal: "Sit the moment a bird gets up.", cue: "One blast, or \"Hup\"", proofMark: "they sit as it flies and stay sitting.", needs: ["whistle@1"], rep: "outcome", outcomes: ["Sat", "Slow", "Chased"], whistle: true, places: ["yard", "park", "field"], gear: ["bumpers", "a helper"],
    steps: [
      { t: "Dropped bumper", mark: "they sit as a bumper drops at your feet.", setup: "On leash, close. Drop it and blow one blast at the same time.", reward: "Treat while they sit. Pick the bumper up yourself." },
      { t: "Thrown bumper", mark: "they sit as you throw one over their head.", setup: "Throw, then one blast. Most of the time, fetch it yourself.", reward: "Treat while they sit; send them one time in three." },
      { t: "Launcher", mark: "they sit as a bumper launcher fires.", setup: "Launcher 20 yards off, long line on.", reward: "Treat while they sit." },
      { t: "Flushed pigeon, with a mentor", mark: "they sit as a pigeon flushes in front of them.", setup: "With an experienced trainer, following your state's rules on birds. Long line on.", reward: "Treat while they sit, then hunt on." },
    ]},
  { id: "flushshot", track: "flush", name: "Steady to flush and shot", goal: "Stay sitting through the flush and the gun.", cue: "\"Hup\" if needed", proofMark: "they sit through the flush and the shot.", needs: ["hup", "gun@2"], rep: "outcome", outcomes: ["Steady", "Moved", "Broke"], places: ["field"], gear: ["a launcher", "a blank pistol", "a helper"],
    steps: [
      { t: "Blank at 30 yd", mark: "they stay sitting through the launch and a blank 30 yards away.", setup: "The helper fires as the launcher goes.", reward: "Treat while they sit." },
      { t: "Blank at 10 yd", mark: "they stay sitting with the blank 10 yards away.", setup: "Same.", reward: "Treat while they sit." },
      { t: "Your shot", mark: "they stay sitting when you shoot after the flush.", setup: "Gun in a safe direction, the dog well out of your line of fire.", reward: "Send them by name for the retrieve, or hunt on." },
    ]},
  { id: "frange", track: "flush", name: "Range control", goal: "Never out of gun range, even on hot scent.", cue: "Two pips = turn; a trill = come", proofMark: "they turn inside 30 yards without being asked.", needs: ["quarter", "come:reliable"], rep: "outcome", whistle: true, places: ["park", "field"], gear: ["a whistle", "a long line"],
    steps: [
      { t: "Check in at 20 yd", mark: "they look back or swing in by 20 yards.", setup: "Light cover. Stand still when they reach 20 yards and wait.", reward: "Treat at your side, then send them on." },
      { t: "Off scent from 40 yd", mark: "they come in on the trill while working scent 40 yards out.", setup: "Drag a wing beforehand so there's real scent. Long line on.", reward: "Jackpot, then send them back to the scent." },
      { t: "Turn before 30 yd", mark: "they turn back before 30 yards with no whistle.", setup: "Walk and say nothing. Pip only if they pass 30.", reward: "Hunting on is the reward; a treat now and then." },
    ]},
  { id: "uplandret", track: "flush", name: "Upland retrieve", goal: "Find it in thick cover, bring it back, in the heat too.", cue: "Their name; \"Dead bird\" for a lost one", proofMark: "they find it in cover and deliver to hand.", needs: ["retrieve", "birds@2"], rep: "outcome", youngCap: 1, places: ["yard", "park", "field"], gear: ["bumpers with a wing", "a helper"],
    steps: [
      { t: "Short grass, 20 yd", mark: "a clean retrieve from short grass at 20 yards.", setup: "A helper throws; send by name.", reward: "Treat on delivery." },
      { t: "Knee-high cover", mark: "they hunt it up in knee-high cover and bring it back.", setup: "Throw 20 to 30 yards into the cover. Let them use their nose; don't walk in.", reward: "Treat on delivery." },
      { t: "Lost bird", mark: "they search on \"Dead bird\" and find one they didn't see fall.", setup: "Hide it 15 yards into cover, downwind, 2 minutes before.", reward: "Treat on delivery." },
      { t: "Heavy cover, warm day", mark: "a clean retrieve in heavy cover, with a water break between each.", setup: "Early morning. Two retrieves, then rest. Stop at the first heavy panting.", reward: "Water first, then a treat." },
    ]},

  // ---------- Hog bay dog: find, bay from a distance, come off. No contact with a hog at any step. ----------
  { id: "gearon", track: "hog", name: "Gear on", goal: "Vest and GPS collar mean good things.", cue: "\"Gear\"", proofMark: "they stand happily while the vest and collar go on.", needs: ["handling|chin"], gear: ["a cut vest or chest protector", "a GPS collar"],
    steps: [
      { t: "Vest on, treats", mark: "they stay relaxed as the vest goes over their back.", setup: "Let them sniff it first. One strap at a time, over several sessions.", reward: "A treat for every strap." },
      { t: "Worn 5 minutes", mark: "they move and play normally in the vest.", setup: "Fasten it, then play or feed dinner. Check for rubbing.", reward: "Dinner or a game in the vest." },
      { t: "Worn 30 minutes", mark: "they walk for a while and ignore the vest.", setup: "A walk at home. Check under the arms when it comes off.", reward: "Treats along the walk." },
      { t: "GPS collar", mark: "they ignore the GPS collar while moving.", setup: "Snug enough for two fingers. Short wear first. This is a tracking collar only; no shock.", reward: "Treats and a walk." },
      { t: "Both, in the truck", mark: "they ride calmly in the vest and collar.", setup: "Gear on, load up, engine on, then a short ride.", reward: "Treats in the box, then a fun stop." },
    ]},
  { id: "hogtrail", track: "hog", name: "Scent trailing", goal: "Follow a hog-scent drag to the end, nose down.", cue: "\"Track\"", proofMark: "they work the line nose down to the end.", needs: ["come"], rep: "outcome", outcomes: ["Found", "Needed help", "Lost it"], places: ["yard", "park", "field"], gear: ["hog scent on a rag", "a harness and long line", "flags"],
    steps: [
      { t: "50 m, 30 minutes old", mark: "they follow a 50 m drag to the scent rag.", setup: "Drag a scented rag 50 m downwind, straight. Flag the start and end. Wait 30 minutes.", reward: "A jackpot next to the rag at the end." },
      { t: "200 m", mark: "they follow 200 m to the end.", setup: "Same, longer. Harness and long line.", reward: "Jackpot at the end." },
      { t: "500 m", mark: "they follow 500 m to the end.", setup: "Use the distance tracker to lay it.", reward: "Jackpot at the end." },
      { t: "2 hours old", mark: "they follow a 2-hour-old line to the end.", setup: "Shorten it to 200 m when you age it.", reward: "Jackpot at the end." },
      { t: "With turns", mark: "they work two turns without help.", setup: "Flag each turn so you know the line. Stand still when they check; let them solve it.", reward: "Jackpot at the end." },
    ]},
  { id: "bay", track: "hog", name: "Bay at distance", goal: "Bark and hold from 5 m or more. Never close in.", cue: "\"Bay\"", proofMark: "they bark and hold their distance until you call.", needs: ["hogtrail@1"], rep: "outcome", outcomes: ["Held off", "Crept in", "Touched it"], places: ["yard", "park", "field"], gear: ["a scented dummy or barrel", "a long line", "a helper"],
    steps: [
      { t: "Bark at 5 m", mark: "they bark at a scented, still target from 5 m.", setup: "A hog-scented barrel or dummy. Long line held so they can't get closer than 5 m. A helper shakes it once to start the barking.", reward: "Toss treats behind them, away from the target." },
      { t: "Hold the bay 10 s", mark: "they bark for 10 seconds and stay 5 m off.", setup: "Same, line slack. Step in with the line if they creep.", reward: "Toss treats behind them." },
      { t: "Hold the bay 30 s", mark: "they bark for 30 seconds and stay back.", setup: "Same.", reward: "Call them off to a jackpot." },
      { t: "Never closing in", mark: "they hold their distance when the target moves a little.", setup: "The helper rocks the target with a rope. Log Touched it if they make contact, and go back a step.", reward: "Call them off to a jackpot." },
    ]},
  { id: "offbay", track: "hog", name: "Off the bay", goal: "Leave the bay the first time you call.", cue: "Name + \"Come\", or a trill", proofMark: "they leave the bay and come on one call.", needs: ["bay@1", "come:reliable"], rep: "outcome", whistle: true, outcomes: ["First call", "Second call", "Kept baying"], places: ["yard", "park", "field"], gear: ["a scented dummy or barrel", "a whistle", "a long line"],
    steps: [
      { t: "Called off, close", mark: "they turn away from the target and come on one call from 10 m.", setup: "Let them bay 5 seconds, then call once and back up.", reward: "Jackpot, then send them back to bay." },
      { t: "On the trill", mark: "they leave the bay on one trill.", setup: "Trill only. Same distance.", reward: "Jackpot, then send them back." },
      { t: "From 50 m", mark: "they leave the bay and come 50 m on the trill.", setup: "Long line dragging, a helper near the target.", reward: "The best thing you have." },
    ]},
  { id: "loadup", track: "hog", name: "Load up", goal: "Into the box on cue, a quiet ride, out only when told.", cue: "\"Load up\"", proofMark: "they load on one cue and settle.", needs: ["car"], gear: ["a dog box or crate in the truck"],
    steps: [
      { t: "Into the box", mark: "they hop into the box on one cue.", setup: "Truck parked, box open, treats inside.", reward: "Treat inside the box." },
      { t: "Wait for the door", mark: "they wait inside with the door open.", setup: "Open slowly. If they come forward, close it and try again.", reward: "Treat inside, then \"OK\" to get out." },
      { t: "Quiet ride", mark: "they ride 10 minutes quietly.", setup: "Short rides first. Shade and airflow; never leave a dog in a hot box.", reward: "A calm stop and a walk." },
    ]},

  // ---------- Blood tracking ----------
  { id: "trackstart", track: "tracking", name: "Track start", goal: "Harness on means nose down and work.", cue: "\"Track\"", proofMark: "they drop their nose on the line and go.", needs: ["charge"], places: ["yard", "park", "field"], gear: ["a tracking harness", "a 20-30 ft line"],
    steps: [
      { t: "Harness means tracking", mark: "they put their nose down within a few seconds of the harness going on.", setup: "Use this harness only for tracking. Put it on at the start of a treat scatter in short grass.", reward: "The treats on the ground." },
      { t: "Nose to the spot", mark: "they sniff a blood spot you point at.", setup: "A few drops of deer blood on a leaf. Point, say nothing, wait.", reward: "A treat placed right on the spot." },
      { t: "10 m treat trail", mark: "they follow a 10 m line of blood and treats.", setup: "A drop of blood every step, a treat every third step.", reward: "The treats, and a jackpot at the end." },
    ]},
  { id: "bloodline", track: "tracking", name: "Blood line", goal: "Stay on an old line to the deer.", cue: "\"Track\"", proofMark: "they stay on the line and work out the losses.", needs: ["trackstart"], rep: "outcome", outcomes: ["Found", "Needed help", "Lost"], places: ["park", "field"], gear: ["deer blood (about 2 oz)", "flags or GPS marks", "a harness and line"],
    steps: [
      { t: "50 yd, 1 hour", mark: "they follow a straight 50-yard line, 1 hour old.", setup: "About 2 oz of blood, dabbed or squirted. Mark the line so you know where it is. Hide a deer hide or hoof at the end.", reward: "The hide and a jackpot." },
      { t: "100 yd, 4 hours", mark: "they follow 100 yards, 4 hours old.", setup: "Same amount of blood.", reward: "The hide and a jackpot." },
      { t: "One turn", mark: "they work one turn on a 150-yard line.", setup: "A wide, easy bend first. Stand still when they overshoot.", reward: "The hide and a jackpot." },
      { t: "300 yd, 12 hours", mark: "they follow 300 yards, laid the night before.", setup: "Lay it at dusk, run it at dawn.", reward: "The hide and a jackpot." },
      { t: "Three turns", mark: "they work three turns on a 300-yard line.", setup: "At least one right angle.", reward: "The hide and a jackpot." },
      { t: "A gap in the line", mark: "they bridge a 10-yard gap with no blood.", setup: "Leave 10 yards blank, then pick it up again. Let them circle.", reward: "The hide and a jackpot." },
      { t: "500 yd, 24 hours", mark: "they follow a 500-yard, day-old line with turns.", setup: "Roughly the length and age of a real recovery.", reward: "The hide and a jackpot." },
    ]},
  { id: "findend", track: "tracking", name: "Find and indicate", goal: "Stay at the deer until you get there.", cue: "None", proofMark: "they stay at the find until you arrive.", needs: ["bloodline@1"], rep: "outcome", outcomes: ["Stayed", "Came back", "Chewed or left"], places: ["yard", "park", "field"], gear: ["a deer hide or hoof", "a long line"],
    steps: [
      { t: "The hide at the end", mark: "they stop at the hide when they find it.", setup: "A short, easy line to a hide. You follow close behind.", reward: "Jackpot on the ground beside the hide." },
      { t: "Wait for you", mark: "they stay beside it while you walk the last 10 yards.", setup: "Let the line run through your hands, stop, then walk in.", reward: "Jackpot beside the hide." },
      { t: "Until you arrive", mark: "they stay at the find until you arrive from 30 yards back.", setup: "No calling, no hurry. If they chew it, shorten the distance.", reward: "The best thing you have, beside the hide." },
    ]},
  { id: "linehand", track: "tracking", name: "Line handling", goal: "Your skill: a quiet line and a good read of the dog.", cue: "None", proofMark: "you follow at their pace on a slack line.", needs: ["trackstart"], rep: "outcome", outcomes: ["Smooth", "Some pulling", "Took over"], places: ["park", "field"], gear: ["a 20-30 ft tracking line", "flags"],
    steps: [
      { t: "Slack line", mark: "you keep the line slack for a whole 50-yard track.", setup: "Let it run through your hands, over brush rather than around it.", reward: "They get the find; you get a clean run." },
      { t: "Their pace", mark: "you follow at their pace and never steer.", setup: "If you know the line, don't show it. Stop when they stop.", reward: "The find." },
      { t: "Read a loss", mark: "you stop, back up to the last blood and let them restart.", setup: "Flag the last blood you saw. On a loss, go back to the flag and give it 2 minutes.", reward: "A treat on the last spot, then on they go." },
    ]},

  // ---------- Shed antler ----------
  { id: "shedret", track: "shed", name: "Antler retrieve", goal: "Antlers are the best toy there is.", cue: "\"Find the bone\"", proofMark: "they bring the antler to your hand.", needs: ["retrieve|hallret"], gear: ["an antler-scented toy", "a shed antler"],
    steps: [
      { t: "Scented toy", mark: "they chase and pick up an antler-scented toy.", setup: "A soft antler-shaped toy or a scented bumper. Short tosses.", reward: "Another throw." },
      { t: "A real shed", mark: "they pick up a real antler.", setup: "Start with a small, smooth one. Tips rounded or taped so it never pokes them.", reward: "Treat, then another throw." },
      { t: "To hand", mark: "they deliver the antler to your hand.", setup: "Hand low and still. Say \"Give\".", reward: "Trade for a treat, then throw again." },
    ]},
  { id: "shedsearch", track: "shed", name: "Shed search", goal: "Hunt for an antler with nose and eyes.", cue: "\"Find the bone\"", proofMark: "they search until they find it.", needs: ["shedret"], rep: "outcome", outcomes: ["Found", "Needed help", "Gave up"], gear: ["2 or 3 sheds", "gloves"],
    steps: [
      { t: "In the house", mark: "they find an antler hidden in one room.", setup: "Wear gloves so it doesn't smell like you. Half in view at first.", reward: "Treat and a game with the antler." },
      { t: "In the yard", mark: "they find one in the yard.", setup: "Hide it 20 minutes before, downwind.", reward: "Treat and a throw." },
      { t: "Tall grass", mark: "they find one they can't see.", setup: "Grass over the antler's height.", reward: "Treat and a throw." },
      { t: "A field", mark: "they find one in a field the size of a football pitch.", setup: "Three sheds, spread out. Walk into the wind.", reward: "Treat and a throw for each find." },
      { t: "An old shed", mark: "they find an antler left outside for a week.", setup: "Leave it out a week so your scent is gone.", reward: "Jackpot." },
    ]},
  { id: "shedhunt", track: "shed", name: "Field hunt", goal: "A real shed hunt, working ahead of you.", cue: "\"Find the bone\"", proofMark: "they hunt ahead of you and find the antler.", needs: ["shedsearch", "come"], rep: "outcome", outcomes: ["Found", "Needed help", "Nothing found"], places: ["park", "field"], gear: ["planted sheds", "water"],
    steps: [
      { t: "Quarter the field", mark: "they work side to side ahead of you on \"Find the bone\".", setup: "Plant 4 sheds along your route. Walk a zigzag.", reward: "Treat and a throw for each find." },
      { t: "Show or bring", mark: "they bring it back, or stop and wait by it.", setup: "Choose one and stick with it. Big antlers: teach them to wait by it.", reward: "Treat at the antler or on delivery." },
      { t: "The real thing", mark: "a find they made on their own on real ground.", setup: "Check your state's shed season and the land rules, and leave wintering deer alone. Plant one so they always get a win.", reward: "Jackpot." },
    ]},

  // ---------- Nose work ----------
  { id: "odor", track: "nosework", name: "Odor intro", goal: "One smell pays: birch, then anise, then clove.", cue: "\"Search\"", proofMark: "they put their nose on the tin and stay there.", needs: ["charge"], gear: ["birch, anise and clove kits", "vented tins", "gloves"],
    steps: [
      { t: "Birch and a treat", mark: "their nose goes to the tin with birch and a treat in it.", setup: "A scented swab in a vented tin, a treat on top. Gloves on; never let them lick the oil or the swab.", reward: "The treat, right at the tin." },
      { t: "Birch alone", mark: "their nose goes to the tin with no treat showing.", setup: "Same tin, treats in your hand.", reward: "Treat placed at the tin." },
      { t: "Anise", mark: "their nose goes to the anise tin.", setup: "A fresh swab, its own tin. Keep each odor's kit separate.", reward: "Treat at the tin." },
      { t: "Clove", mark: "their nose goes to the clove tin.", setup: "Same.", reward: "Treat at the tin." },
    ]},
  { id: "boxes", track: "nosework", name: "Boxes and containers", goal: "Find the one that pays.", cue: "\"Search\"", proofMark: "they go to the right box and ignore the rest.", needs: ["odor@1"], rep: "outcome", outcomes: ["Right box", "Needed help", "Wrong box"], places: ["home", "yard", "street", "park"], gear: ["10 cardboard boxes", "a hide"],
    steps: [
      { t: "1 of 3", mark: "they pick the right box out of 3.", setup: "Boxes open, a meter apart. Walk past them without pointing.", reward: "Treat in the right box." },
      { t: "1 of 10", mark: "they pick the right box out of 10.", setup: "Two rows of 5. Move the hide each time, and keep one box just for the hide.", reward: "Treat in the right box." },
      { t: "Bags and bins", mark: "they find it in luggage, bins or closed boxes.", setup: "Lids closed. A few different containers.", reward: "Treat at the container." },
      { t: "A blank search", mark: "they search all of them and don't alert when there's no hide.", setup: "No hide this time. Walk the row, then say \"Finish\" and leave.", reward: "Then one easy search with a hide, right after." },
    ]},
  { id: "searchrooms", track: "nosework", name: "Interiors and vehicles", goal: "Search a room or a car and find the source.", cue: "\"Search\"", proofMark: "they search the area and find the source.", needs: ["boxes"], rep: "outcome", outcomes: ["Found", "Needed help", "Missed it"], places: ["home", "yard", "street", "park"], gear: ["a hide", "a long line"],
    steps: [
      { t: "One room", mark: "they find the hide in one room.", setup: "Nose height, easy air. Start them at the door.", reward: "Treat at the source." },
      { t: "Two rooms", mark: "they search both rooms and find it.", setup: "Hide in either one.", reward: "Treat at the source." },
      { t: "Around a car", mark: "they find the hide on the outside of a car.", setup: "Engine cold, parked off the road, on leash. A hide at the wheel arch or bumper.", reward: "Treat at the source." },
      { t: "High and hidden", mark: "they work out a hide that's up high or behind something.", setup: "Chest height first, then inside a drawer.", reward: "Treat as close to the source as they can get." },
    ]},
  { id: "alert", track: "nosework", name: "Alert", goal: "Freeze with the nose on the source until you call it.", cue: "None; you say \"Alert!\"", proofMark: "they freeze on the source until the timer marks it.", needs: ["odor", "stay"], gear: ["a hide"],
    steps: [
      { t: "Freeze 1 second", mark: "they freeze on the source until the timer marks it.", setup: "A tin on the floor. Wait a beat longer than usual before you pay.", reward: "Treat at the source.", hold: [1, 1] },
      { t: "Freeze 3 seconds", mark: "they stay frozen until the timer marks it.", setup: "Same. If the nose comes off, it's a Miss.", reward: "Treat at the source.", hold: [2, 4] },
      { t: "Until you call it", mark: "they hold the freeze while you step back and say \"Alert!\".", setup: "Stand a little to the side. Say \"Alert!\", then mark.", reward: "Jackpot at the source." },
    ]},

  // ---------- Sport obedience ----------
  { id: "front", track: "sport", name: "Front and finish", goal: "Sit straight in front, then swing to heel.", cue: "\"Front\", then \"Finish\"", proofMark: "a straight sit in front, then a tidy swing to heel.", needs: ["heel@2", "sit"],
    steps: [
      { t: "Straight in front", mark: "they sit straight, close, facing you.", setup: "Lure them in close between your feet. Stand with your toes as the guide.", reward: "Treat at your belt, straight above their nose." },
      { t: "From 1 m", mark: "they come in and sit straight from 1 m.", setup: "Say \"Front\", hands at your belt.", reward: "Treat at your belt." },
      { t: "Swing to heel", mark: "they swing around to sit at your left side.", setup: "Lure back along your left leg, then forward into heel.", reward: "Treat at your left seam." },
      { t: "Both, from 3 m", mark: "a straight front from 3 m, then the finish.", setup: "Wait 2 seconds between the two so they don't run together.", reward: "Treat at your left seam." },
    ]},
  { id: "precheel", track: "sport", name: "Precision heel", goal: "Heads up, glued to your leg, sits when you stop.", cue: "\"Heel\"", proofMark: "attention and position through turns and halts.", needs: ["heel:proofed"],
    steps: [
      { t: "Heads up", mark: "they look up at you for 5 steps in heel.", setup: "Treat held at your left chest. Mark the look, not just the place.", reward: "Treat at your left seam." },
      { t: "Sit at the halt", mark: "they sit by themselves when you stop.", setup: "Slow down over two steps, then halt. Help with a hand signal at first.", reward: "Treat at your left seam while they sit." },
      { t: "About-turn", mark: "they stay with you through an about-turn.", setup: "Turn to the right, small steps.", reward: "Treat as they catch your leg." },
      { t: "Figure 8", mark: "they stay in place around two markers.", setup: "Two cones or people 2.5 m apart. Speed up on the outside, slow down on the inside.", reward: "Treat at your left seam." },
    ]},

  // ---------- Tricks and body awareness ----------
  { id: "spin", track: "tricks", name: "Spin and back up", goal: "A circle each way, and walking straight backward.", cue: "\"Spin\", \"Back up\"", proofMark: "they do it on the word.", needs: ["charge"],
    steps: [
      { t: "Lure a circle", mark: "they turn all the way around after your hand.", setup: "Treat at the nose, draw a wide circle.", reward: "Treat as they come back to face you." },
      { t: "Signal, both ways", mark: "they spin on a hand signal, left and right.", setup: "Empty hand, a smaller circle. Balance both sides.", reward: "Treat from your other hand." },
      { t: "The word", mark: "they spin on \"Spin\".", setup: "Word first, then the signal. Fade the signal.", reward: "Treat." },
      { t: "Back up 1 step", mark: "they take one step backward.", setup: "Stand close, step toward them gently. Keep the treat low so their spine stays level.", reward: "Treat under their chin." },
      { t: "Back up 3 steps", mark: "they take three steps back in a row.", setup: "Same. A wall on one side keeps them straight.", reward: "Treat tossed between their front paws." },
      { t: "Down a hallway", mark: "they back down a hallway on the word.", setup: "Narrow hallway. Say \"Back up\", then wait.", reward: "Toss the treat to them." },
    ]},
  { id: "perch", track: "tricks", name: "Perch pivot", goal: "Front paws up, rear feet walking around. Great for control.", cue: "\"Perch\"", proofMark: "their rear feet walk around a full circle.", needs: ["charge"], gear: ["a low, non-slip book or step"],
    steps: [
      { t: "Front paws up", mark: "both front paws are on the book.", setup: "Book wrapped in non-slip mat. Lure forward over it, or wait for a paw.", reward: "Treat up high so the paws stay on." },
      { t: "One rear step", mark: "a rear foot steps sideways.", setup: "Take a small step around the perch, into their shoulder.", reward: "Treat at once, paws still up." },
      { t: "Quarter turn", mark: "they walk their rear a quarter of the way around.", setup: "Keep moving in one direction.", reward: "Treat at your leg." },
      { t: "Full circle, each way", mark: "they pivot all the way around, each way.", setup: "Do the weaker side first.", reward: "Treat, then a game." },
    ]},
  { id: "shapes", track: "tricks", name: "Paw, bow, roll over", goal: "Three party tricks, one at a time.", cue: "\"Paw\", \"Bow\", \"Roll over\"", proofMark: "they do the one you named.", needs: ["down"],
    steps: [
      { t: "Paw", mark: "their paw lifts into your hand.", setup: "Hold a treat in a closed fist at their chest height; wait for a paw.", reward: "Treat from the other hand." },
      { t: "Paw on the word", mark: "they give a paw when you say \"Paw\".", setup: "Word, pause, open hand.", reward: "Treat from the other hand." },
      { t: "Bow", mark: "elbows go down while the rear stays up.", setup: "From a stand, lure between the front legs. Mark before the rear drops.", reward: "Treat low, between the paws." },
      { t: "Roll onto the side", mark: "they roll onto one hip and shoulder.", setup: "From a down, lure the nose to the shoulder. Soft floor; skip it for a sore back or a full stomach.", reward: "Treat on the floor beside them." },
      { t: "All the way over", mark: "they roll all the way over.", setup: "Carry the lure across. Go at their speed.", reward: "Jackpot." },
    ]},
  { id: "balance", track: "tricks", name: "Balance and cavaletti", goal: "Core strength and careful feet, for field dogs most of all.", cue: "\"Up\", \"Walk\"", proofMark: "they move slowly and cleanly.", needs: ["perch", "plates"], gear: ["a cushion or wobble disc", "4 low poles"],
    steps: [
      { t: "Stand on a cushion", mark: "they stand with all four feet steady on a cushion.", setup: "A firm cushion on a non-slip floor. A few seconds at a time.", reward: "Treat at nose height so they stay level." },
      { t: "Wobble disc", mark: "they hold their balance with front feet on a wobble disc.", setup: "Half inflated. Help them on; they step off when they want.", reward: "Slow treats while they balance." },
      { t: "Walk the poles", mark: "they walk over 4 poles without a touch.", setup: "Poles flat on the floor, a body length apart.", reward: "Treat at the end of the line." },
      { t: "Trot the poles", mark: "they trot over low poles with even steps.", setup: "No higher than their wrist. Two or three passes, then rest.", reward: "Treat at the end of the line." },
    ]},
];

// Behavior helpers: plans for common problems, not skills to master. Each step links to the skill that builds it.
// stop: what ends the plan and sends the owner to a professional. measure: a number logged after each session.
const HELPERS = [
  { id: "jump", name: "Jumping on people", uses: ["floor", "mat"], goal: "Four paws on the floor earns the hello.", stop: "Growling, snapping or stiffness when people come close",
    steps: [
      { t: "Stop paying for jumps", do: "When they jump, turn away, arms folded, no words. Even \"off\" is attention." },
      { t: "Mark the floor", do: "The moment all four paws are down, say Yes and toss a treat at their feet." },
      { t: "Visitors do it too", do: "Leash on. The visitor turns away on a jump and comes back when the paws are down." },
      { t: "A job at the door", do: "Send them to the mat before the door opens. Treats stay on the mat until the guest sits." },
    ]},
  { id: "pull", name: "Pulling on the leash", uses: ["leash", "checkin"], goal: "A tight leash stops the walk; a loose one moves it.", stop: "Choking, coughing or collapse on walks (see a vet)",
    steps: [
      { t: "The right gear", do: "A well-fitted harness with a front ring, a 2 m leash. Retractable leashes teach pulling." },
      { t: "Tight means stop", do: "The moment it goes tight, freeze. Walk on the second it goes slack." },
      { t: "Pay at the seam", do: "Say Yes for a slack leash and treat at your pant seam, every few steps at first." },
      { t: "Pulling never works", do: "To reach a bush they want, walk with a loose leash, then \"OK, go sniff\". Sniffing is the pay." },
    ]},
  { id: "barkdoor", name: "Barking at the door or window", uses: ["doorbell", "mat"], goal: "The bell means mat, not bark.", stop: "Lunging at the glass or biting anyone near the door",
    steps: [
      { t: "Block the view", do: "Frosted film or a closed curtain. Every rehearsal of barking makes it stronger." },
      { t: "Mark the quiet", do: "Stand near them. At the first pause in barking, say Yes and treat. Then treat for longer pauses." },
      { t: "Bell, then mat", do: "Ring the bell yourself, send them to the mat, treat on the mat. Ten easy rings a day." },
      { t: "Real visitors", do: "Same thing with a helper, then a guest. Treats keep coming on the mat until the door shuts." },
    ]},
  { id: "react", name: "Barking at dogs or people", uses: ["checkin", "leave", "dogmeet"], goal: "Seeing a dog or a stranger means look back at you.", stop: "Bite attempts, or reactions that get closer and faster each week", measure: { unit: "m", label: "How far away was it when they first reacted?" },
    steps: [
      { t: "Find the distance", do: "How far away can the other dog be while yours can still eat? That's where you train. Farther is always fine." },
      { t: "Mark the look", do: "The moment they look at it and stay quiet, say Yes and treat. Looking pays." },
      { t: "The look back", do: "Wait a second longer. When they look back at you by themselves, say Yes and jackpot." },
      { t: "A little closer", do: "Two good days, then one meter closer. Any barking: turn and walk away, and go back to the easier distance." },
    ]},
  { id: "guard", name: "Guarding food or toys", uses: ["drop", "leave"], goal: "A person coming near means more, not less.", stop: "Stiffening, hard staring, growling, snapping, or children in the home",
    steps: [
      { t: "Make it safe", do: "Feed alone in a quiet place. Pick up the things they guard. Never take food away to test them." },
      { t: "Walk past, drop a treat", do: "While they eat, walk past at 3 m and toss something better. Keep walking. They should look up happy." },
      { t: "A step closer", do: "Closer by half a meter only after several happy days. Loose body and wagging is the go-ahead." },
      { t: "Trade, then give it back", do: "Offer a better treat for a toy, say \"Drop\", then give the toy back. They lose nothing." },
    ]},
  { id: "leftalone", name: "Being left alone", uses: ["alone", "mat", "crate"], goal: "Short absences they never worry about.", stop: "Panic: howling, drooling, scratching at doors, hurting themselves (see a vet)", measure: { unit: "min", label: "Longest calm absence today" },
    steps: [
      { t: "Watch the first minutes", do: "Film them alone. When does worry start: pacing, whining, panting? Every absence stays shorter than that." },
      { t: "Boring exits", do: "Keys, coat, sit back down. Again and again until the keys mean nothing." },
      { t: "Out and back", do: "Step out for a few seconds, come back while they're calm. Mix short and shorter." },
      { t: "Build slowly", do: "Add a little on calm days; go back after a bad one. Use a sitter or daycare so they're never left past their limit." },
    ]},
];

// Canine Good Citizen: the 10 test items and the skills that cover each one.
const CGC = [
  { t: "Accepting a friendly stranger", needs: ["floor"] }, { t: "Sitting politely for petting", needs: ["sit", "floor"] },
  { t: "Appearance and grooming", needs: ["chin"] }, { t: "Out for a walk on a loose leash", needs: ["leash"] },
  { t: "Walking through a crowd", needs: ["leash", "public"] }, { t: "Sit and down on cue, staying in place", needs: ["sit", "down", "stay"] },
  { t: "Coming when called", needs: ["come"] }, { t: "Reaction to another dog", needs: ["dogmeet"] },
  { t: "Reaction to distraction", needs: ["checkin", "leave"] }, { t: "Supervised separation", needs: ["alone"] },
];

// Socialization passport: 60 good first experiences before 16 weeks, each paired with food.
const PASSPORT = [
  { id: "people", name: "People", items: ["Man with a beard", "Woman in a hat", "Child", "Toddler", "Person in a uniform", "Person with a cane or walker", "Person in sunglasses", "Person in a hood", "Delivery person", "Small crowd"] },
  { id: "surfaces", name: "Surfaces", items: ["Grass", "Gravel", "Wet pavement", "Metal grate", "Slippery tile", "Carpeted stairs", "Wobbly board", "Sand", "Puddle", "Bridge or deck"] },
  { id: "sounds", name: "Sounds", items: ["Vacuum", "Blender", "Doorbell", "Traffic", "Thunder (recording, quiet)", "Fireworks (recording, quiet)", "Dog barking", "Baby crying", "Hair dryer", "Lawn mower"] },
  { id: "handling", name: "Handling", items: ["Paws held", "Ears looked in", "Mouth opened", "Nails touched", "Collar grabbed", "Brushed", "Bath", "Towel dry"] },
  { id: "places", name: "Places", items: ["Car ride", "Pet store", "Vet lobby (happy visit)", "Friend's house", "Park", "Parking lot", "Outdoor café", "Elevator"] },
  { id: "animals", name: "Animals", items: ["Calm adult dog", "Another puppy", "Cat", "Horses or livestock at a distance", "Birds", "Small pet"] },
  { id: "objects", name: "Objects", items: ["Umbrella opening", "Bicycle", "Skateboard", "Stroller", "Shopping cart", "Balloon", "Flapping flag", "Trash can lid"] },
];

// Drive types: what a dog is bred to love doing. Sets the default reward, tips and later the sport tracks.
const DRIVES = {
  retrieve: { name: "Retriever type", reward: "Food, and a thrown toy as a bonus", watch: "mouthing, breaking on thrown things, door dashing" },
  point: { name: "Pointing type", reward: "Food; a flirt pole for play", watch: "range on walks, recall around bird scent" },
  flush: { name: "Flushing spaniel type", reward: "Food and toys", watch: "range, staying steady when something flies" },
  scent: { name: "Scent hound type", reward: "High-value food", watch: "recall with the nose down, howling" },
  sight: { name: "Sighthound type", reward: "Food; a lure toy for play", watch: "chasing small animals, recall in open spaces" },
  herd: { name: "Herding type", reward: "Toys and tug; food works too", watch: "chasing motion, sensitivity to noise" },
  terrier: { name: "Terrier type", reward: "Tug and food", watch: "leave it, digging, other dogs" },
  guard: { name: "Guardian or bull type", reward: "Food", watch: "greetings, other dogs, guarding things" },
  companion: { name: "Companion type", reward: "Small, soft food", watch: "potty training, being left alone, jumping up" },
};

// [name, drive, size (s m l g), flat-faced]
const BREEDS = [
  ["Labrador Retriever", "retrieve", "l"], ["Golden Retriever", "retrieve", "l"], ["Chesapeake Bay Retriever", "retrieve", "l"],
  ["Flat-Coated Retriever", "retrieve", "l"], ["Nova Scotia Duck Tolling Retriever", "retrieve", "m"], ["Boykin Spaniel", "flush", "m"],
  ["English Springer Spaniel", "flush", "m"], ["Cocker Spaniel", "flush", "m"], ["German Shorthaired Pointer", "point", "l"],
  ["German Wirehaired Pointer", "point", "l"], ["English Pointer", "point", "l"], ["English Setter", "point", "l"],
  ["Irish Setter", "point", "l"], ["Brittany", "point", "m"], ["Vizsla", "point", "m"], ["Weimaraner", "point", "l"],
  ["Wirehaired Pointing Griffon", "point", "m"], ["Small Munsterlander", "point", "m"], ["Beagle", "scent", "m"],
  ["Bloodhound", "scent", "g"], ["Coonhound", "scent", "l"], ["Basset Hound", "scent", "m"], ["Dachshund", "scent", "s"],
  ["Catahoula Leopard Dog", "herd", "l"], ["Blackmouth Cur", "scent", "l"], ["Plott Hound", "scent", "l"],
  ["Greyhound", "sight", "l"], ["Whippet", "sight", "m"], ["Border Collie", "herd", "m"], ["Australian Shepherd", "herd", "m"],
  ["Australian Cattle Dog", "herd", "m"], ["German Shepherd", "herd", "l"], ["Belgian Malinois", "herd", "l"],
  ["Shetland Sheepdog", "herd", "s"], ["Corgi", "herd", "s"], ["Jack Russell Terrier", "terrier", "s"],
  ["Rat Terrier", "terrier", "s"], ["Yorkshire Terrier", "terrier", "s"], ["Miniature Schnauzer", "terrier", "s"],
  ["Bull Terrier", "terrier", "m"], ["American Pit Bull Terrier", "guard", "m"], ["American Staffordshire Terrier", "guard", "m"],
  ["Rottweiler", "guard", "l"], ["Doberman", "guard", "l"], ["Boxer", "guard", "l", 1], ["Mastiff", "guard", "g"],
  ["Cane Corso", "guard", "g"], ["Great Dane", "guard", "g"], ["Bernese Mountain Dog", "guard", "g"], ["Dogo Argentino", "guard", "l"],
  ["Siberian Husky", "sight", "l"], ["Poodle", "retrieve", "m"], ["Goldendoodle", "companion", "m"], ["Labradoodle", "companion", "m"],
  ["Cavalier King Charles Spaniel", "companion", "s"], ["Shih Tzu", "companion", "s", 1], ["Maltese", "companion", "s"],
  ["Chihuahua", "companion", "s"], ["Pomeranian", "companion", "s"], ["Havanese", "companion", "s"],
  ["French Bulldog", "companion", "s", 1], ["English Bulldog", "guard", "m", 1], ["Pug", "companion", "s", 1],
  ["Boston Terrier", "companion", "s", 1],
];
