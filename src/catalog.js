// Pocket Trainer catalog: every skill, the passport checklist and the breed table.
// Plain data, shared by the web app and (through tools/gen_catalog.js) the iPhone app.
//
// Skill fields
//   track   foundations | puppy | life (sport tracks arrive in phase 2)
//   needs   prerequisites: "sit" = Sit at Fluent, "sit@3" = Sit at step index 3 or later,
//           "come:reliable" = a higher level; "charge" = Yes is charged
//   proof   the proofing grid after Fluent: dur [[value, label]...], dist [labels], dis [labels].
//           Index 0 is the Fluent baseline. Labels finish the sentence "...with/at <label>".
//   places  where it can be practiced (default: everywhere)
//   proofMark  what earns a Yes once the skill is past its ladder (proofing, reviews)
//   steps   the ladder; hold: [min, max] seconds adds the hold timer; keep: true shows Keep going

const TRACKS = [
  { id: "foundations", name: "Foundations", blurb: "The core every dog needs." },
  { id: "puppy", name: "Puppy", blurb: "First weeks home: confidence, crate, gentle mouth." },
  { id: "life", name: "Life skills", blurb: "Vet, grooming, car, guests and going out." },
];

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
