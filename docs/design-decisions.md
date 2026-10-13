# MEENDOC reference lock

Build target: the supplied `airbnb ui.md`, adapted to the explicit MEENDOC frontend brief. Direct implementation is requested in that brief. Live Refero styles were attempted from three angles; all returned NO_SUBSCRIPTION. No live Refero screen or flow is claimed to have been reviewed.

| Decision | Evidence | Preserved role | Purpose |
| --- | --- | --- | --- |
| White canvas, #222222 text, #6a6a6a metadata, #EBEBEB dividers | Supplied Airbnb style and MEENDOC brief | Neutral surface hierarchy | Keep the conversation quiet and readable |
| Coral #FF385C for the microphone, send, save and main CTA; dark secondary CTA | MEENDOC brief takes precedence over contradictory source token notes | One main action per surface | Make the next step recognizable |
| IBM Plex Sans Arabic and Inter, 4px spacing, 12px cards and pill controls | Supplied style and localization specification | Arabic legibility, UI hierarchy | Accessible RTL/LTR application |
| Central assistant, visible composer, secondary discovery | MEENDOC primary objective | Conversation is the homepage | Guest users can start immediately |
| Unbordered square portrait cards with concise metadata | Airbnb listing card pattern | Photography carries discovery | Objective information without invented ratings |
| One question at a time, editable preferences, explicit booking review | User conversation and booking sequences; Refero bundled craft guidance | Progressive disclosure and confirmation | A predictable demo journey |
| Keyboard focus, 44px targets, dialog focus management, reduced motion | Refero craft-details and anti-ai-slop guidance | Accessible interaction | Work across keyboard and small screens |

Media: one locally served 4×4 atlas of generated fictional portraits, displayed as square crops through CSS background positions. No real person is represented by a fictional profile. Generated using the built-in ImageGen tool. Prompt: sixteen fictional Egyptian adult physician portraits, regular 4×4 grid, neutral clinic backgrounds, natural daylight, professional white coats, no labels, credentials or real-person likenesses. Asset: `public/images/fictional-doctors.png`.

Reject: unrelated dashboards on the homepage, ornamental gradients, glass effects, fabricated ratings, decorative serif words, blanket card borders, or clinical claims.

Accessibility refinement: use #E00B41 for primary buttons containing small white text to meet text contrast. The signature #FF385C stays on the microphone, send icon, search icon, logo and saved hearts; white icons meet non-text contrast. Native dialogs also include an explicit Tab/Shift+Tab wrap and restore the initiating control on close.

Voice: recognition is allowed only when a browser explicitly supports on-device processing and already has the selected language available; no cloud speech recognition or health audio upload. Otherwise use text or clearly labeled selectable demo phrases.
