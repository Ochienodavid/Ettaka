# Ettaka Flutter Web + Firebase

This is the Flutter/Dart **web-only** implementation of Ettaka. The existing React/Node app remains in the repository as the behavioral reference. The Flutter web client uses the same Node API contracts so authentication, permissions, records, evidence, disputes, verification, reports, audit activity, and ledger behavior remain aligned instead of being replaced by demo data.

## Preserved product surface

The client keeps the existing navigation and product concepts: public record verification, phone/PIN access, dashboard metrics, land records and record creation, evidence capture, boundary map, disputes and mediation, verification queue, append-only seal ledger, reports/exports, audit activity, rights guidance, settings, dark mode, Gemini digitisation, and Firebase-backed data access.

The record model maps to the existing implementation:

- `records`: plot, tenure, agreement, consent, boundary and seal state
- `parties` and `witnesses`: participants and confirmations
- `evidence`: document, photo, audio and identity fingerprints
- `seals`: append-only hash-chain entries
- `disputes`: mediation workflow and outcomes
- `activity` and `verifications`: auditability and public checks

## Firebase setup

1. Install the FlutterFire CLI: `dart pub global activate flutterfire_cli`.
2. From this directory run `flutterfire configure` and select the Firebase project.
3. Keep the generated `lib/firebase_options.dart` in this directory and update `main.dart` to initialize with `DefaultFirebaseOptions.currentPlatform` if the project uses generated options.
4. Deploy the rules with `firebase deploy --only firestore:rules`.
5. Enable anonymous or phone authentication, Firestore, Storage, and App Check in Firebase Console.
6. Store the Gemini API key in a server-side secret or Firebase callable function. Do not ship it in the Flutter bundle.

The production web flow expects the existing API at `http://localhost:4000/api` (override with `--dart-define=ETTAKA_API_URL=https://your-host/api`). Firebase and Gemini adapters are included for the DevFest Google-tools stack; they must be configured before enabling those services in production. The Flutter client does not include Android or iOS runners.

## Development

```powershell
flutter pub get
flutter run -d chrome
flutter test
flutter build web --dart-define=ETTAKA_API_URL=http://localhost:4000/api
```

Google tools are used meaningfully: Flutter is the cross-platform client, Firebase provides identity/data/storage, and the Dart Gemini service handles assisted agreement digitisation with human review before sealing.
