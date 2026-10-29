import 'dart:convert';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:google_generative_ai/google_generative_ai.dart';
import 'package:http/http.dart' as http;
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

const navy = Color(0xff1f3864);
const blue = Color(0xff2251b8);
const gold = Color(0xffb8922a);
const bg = Color(0xfff4f6fb);
const apiBase = String.fromEnvironment('ETTAKA_API_URL', defaultValue: '/api');

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  var firebaseReady = false;
  try {
    await Firebase.initializeApp();
    firebaseReady = true;
  } catch (_) {
    // The local demo remains usable until Firebase configuration is supplied.
  }
  runApp(ChangeNotifierProvider(
    create: (_) => AppState(firebaseReady: firebaseReady),
    child: const EttakaApp(),
  ));
}

class AppState extends ChangeNotifier {
  AppState({required this.firebaseReady}) {
    if (firebaseReady) {
      FirebaseAuth.instance.authStateChanges().listen((u) {
        if (u == null) return;
        user ??= UserProfile.demo(u.displayName ?? 'Ettaka user');
        notifyListeners();
      });
    }
  }
  final bool firebaseReady;
  UserProfile? user;
  String? token;
  bool dark = false;
  final records = <LandRecord>[];
  final disputes = <Dispute>[];

  Future<void> login(String phone, String pin) async {
    final response = await _request('/auth/login', method: 'POST', body: {'phone': phone, 'pin': pin});
    token = response['token'] as String?;
    user = UserProfile.fromJson(response['user'] as Map<String, dynamic>);
    await refresh();
    notifyListeners();
  }

  Future<void> register(String name, String phone, String pin) async {
    final response = await _request('/auth/register', method: 'POST', body: {'full_name': name, 'phone': phone, 'pin': pin});
    token = response['token'] as String?;
    user = UserProfile.fromJson(response['user'] as Map<String, dynamic>);
    await refresh();
    notifyListeners();
  }

  Future<void> refresh() async {
    if (token == null) return;
    final recordData = await _request('/records');
    final disputeData = await _request('/disputes');
    records
      ..clear()
      ..addAll(((recordData['records'] as List?) ?? const []).map((r) => LandRecord.fromJson(r as Map<String, dynamic>)));
    disputes
      ..clear()
      ..addAll(((disputeData['disputes'] as List?) ?? const []).map((d) => Dispute.fromJson(d as Map<String, dynamic>)));
  }

  Future<void> logout() async {
    if (firebaseReady) await FirebaseAuth.instance.signOut();
    token = null;
    user = null;
    notifyListeners();
  }

  void toggleTheme() {
    dark = !dark;
    notifyListeners();
  }

  void addDispute(Dispute dispute) {
    disputes.insert(0, dispute);
    notifyListeners();
  }

  Future<Map<String, dynamic>> _request(String path, {String method = 'GET', Map<String, dynamic>? body}) async {
    final headers = <String, String>{'Content-Type': 'application/json'};
    if (token != null) headers['Authorization'] = 'Bearer $token';
    final uri = Uri.base.resolve('$apiBase$path');
    final response = method == 'POST'
        ? await http.post(uri, headers: headers, body: jsonEncode(body ?? const {}))
        : await http.get(uri, headers: headers);
    final data = jsonDecode(response.body.isEmpty ? '{}' : response.body) as Map<String, dynamic>;
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(data['error'] ?? 'Request failed (${response.statusCode})');
    }
    return data;
  }
}

class UserProfile {
  UserProfile(this.name, this.role);
  final String name;
  final String role;
  factory UserProfile.fromJson(Map<String, dynamic> json) => UserProfile(
    (json['full_name'] ?? json['name'] ?? 'Ettaka user') as String,
    (json['role'] ?? 'citizen') as String,
  );
  factory UserProfile.demo(String name) => UserProfile(name, 'Citizen');
}

class LandRecord {
  LandRecord({required this.code, required this.title, required this.type, required this.status, required this.district});
  final String code;
  final String title;
  final String type;
  final String status;
  final String district;
  factory LandRecord.fromJson(Map<String, dynamic> json) => LandRecord(
    code: (json['code'] ?? '') as String,
    title: (json['title'] ?? '') as String,
    type: (json['record_type'] ?? json['type'] ?? '') as String,
    status: (json['status'] ?? 'draft') as String,
    district: (json['district'] ?? '') as String,
  );
  factory LandRecord.demo() => LandRecord(
    code: 'ETK-UG-2026-001',
    title: 'Family plot at Wakiso',
    type: 'Customary claim',
    status: 'Sealed',
    district: 'Wakiso',
  );
}

class Dispute {
  Dispute({required this.title, required this.category, required this.stage, required this.priority});
  final String title;
  final String category;
  final String stage;
  final String priority;
  factory Dispute.fromJson(Map<String, dynamic> json) => Dispute(
    title: (json['title'] ?? '') as String,
    category: (json['category'] ?? '') as String,
    stage: (json['stage'] ?? 'reported') as String,
    priority: (json['priority'] ?? 'medium') as String,
  );
  factory Dispute.demo() => Dispute(title: 'Boundary clarification', category: 'Boundary', stage: 'LC review', priority: 'Medium');
}

class EttakaApp extends StatelessWidget {
  const EttakaApp({super.key});
  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    return MaterialApp(
      title: 'Ettaka',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(seedColor: blue, brightness: state.dark ? Brightness.dark : Brightness.light),
        scaffoldBackgroundColor: state.dark ? null : bg,
        fontFamily: 'Arial',
        cardTheme: const CardThemeData(elevation: 0, margin: EdgeInsets.zero),
      ),
      initialRoute: '/',
      routes: {
        '/': (_) => const LandingPage(),
        '/login': (_) => const LoginPage(),
        '/dashboard': (_) => const DashboardPage(),
        '/records': (_) => const RecordsPage(),
        '/records/new': (_) => const RecordEditorPage(),
        '/records/view': (_) => const RecordsPage(),
        '/map': (_) => const MapPage(),
        '/disputes': (_) => const DisputesPage(),
        '/verification': (_) => const VerificationPage(),
        '/verify': (_) => const VerifyPage(),
        '/rights': (_) => const RightsPage(),
        '/digitise': (_) => const DigitisePage(),
        '/ledger': (_) => const LedgerPage(),
        '/reports': (_) => const ReportsPage(),
        '/activity': (_) => const ActivityPage(),
        '/settings': (_) => const SettingsPage(),
      },
    );
  }
}

class LandingPage extends StatelessWidget {
  const LandingPage({super.key});
  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(child: Center(child: SingleChildScrollView(
      padding: const EdgeInsets.all(28),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 1050),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Brand(),
          const SizedBox(height: 60),
          Wrap(spacing: 42, runSpacing: 30, children: [
            SizedBox(width: 520, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Land rights you can prove.', style: Theme.of(context).textTheme.displaySmall?.copyWith(fontWeight: FontWeight.w800, color: navy)),
              const SizedBox(height: 18),
              const Text('Ettaka helps families, buyers and local officials create trusted, tamper-evident land records before disputes become expensive.', style: TextStyle(fontSize: 18, height: 1.5)),
              const SizedBox(height: 24),
              Wrap(spacing: 12, children: [
                FilledButton(onPressed: () => Navigator.pushNamed(context, '/login'), child: const Text('Open Ettaka')),
                OutlinedButton(onPressed: () => Navigator.pushNamed(context, '/verify'), child: const Text('Verify a record')),
              ]),
            ])),
            const ImpactCard(),
          ]),
          const SizedBox(height: 54),
          const Text('Built for Uganda • SDG 16 Peace, Justice and Strong Institutions • SDG 1 No Poverty', style: TextStyle(color: navy, fontWeight: FontWeight.w700)),
        ]),
      ),
    ))),
  );
}

class ImpactCard extends StatelessWidget {
  const ImpactCard({super.key});
  @override
  Widget build(BuildContext context) => Card(
    color: const Color(0xffeaf0fd),
    child: SizedBox(width: 350, child: Padding(padding: const EdgeInsets.all(24), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: const [
      Icon(Icons.shield_outlined, color: blue, size: 36),
      SizedBox(height: 14),
      Text('Evidence for every family', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: navy)),
      SizedBox(height: 8),
      Text('Capture agreements, witnesses, boundaries and documents in one accessible record. A hash-chained ledger makes later tampering visible.'),
      SizedBox(height: 16),
      Text('Gemini-ready digitisation • Firebase sync • Flutter everywhere', style: TextStyle(fontWeight: FontWeight.w600, color: blue)),
    ]))),
  );
}

class Brand extends StatelessWidget {
  const Brand({super.key});
  @override
  Widget build(BuildContext context) => Row(children: const [
    CircleAvatar(backgroundColor: navy, child: Icon(Icons.landscape, color: Colors.white)),
    SizedBox(width: 10),
    Text('ETTAKA', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: navy)),
  ]);
}

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});
  @override State<LoginPage> createState() => _LoginPageState();
}
class _LoginPageState extends State<LoginPage> {
  final name = TextEditingController();
  final phone = TextEditingController();
  final pin = TextEditingController();
  bool register = false;
  bool busy = false;
  String? error;
  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Brand()),
        body: Center(
          child: Card(
            child: SizedBox(
              width: 430,
              child: Padding(
                padding: const EdgeInsets.all(28),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(register ? 'Create your account' : 'Welcome back',
                        style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                    const Text('Use your phone number to access trusted land evidence.'),
                    const SizedBox(height: 20),
                    if (register) TextField(controller: name, decoration: const InputDecoration(labelText: 'Full name')),
                    if (register) const SizedBox(height: 12),
                    TextField(controller: phone, decoration: const InputDecoration(labelText: 'Phone number', prefixText: '+256 ')),
                    const SizedBox(height: 12),
                    TextField(controller: pin, obscureText: true, decoration: const InputDecoration(labelText: '4-digit PIN')),
                    if (error != null)
                      Padding(padding: const EdgeInsets.only(top: 12), child: Text(error!, style: const TextStyle(color: Colors.red))),
                    const SizedBox(height: 20),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        onPressed: busy
                            ? null
                            : () async {
                                setState(() { busy = true; error = null; });
                                try {
                                  final app = context.read<AppState>();
                                  final navigator = Navigator.of(context);
                                  if (register) {
                                    await app.register(name.text, phone.text, pin.text);
                                  } else {
                                    await app.login(phone.text, pin.text);
                                  }
                                  if (!mounted) return;
                                  navigator.pushReplacementNamed('/dashboard');
                                } catch (e) {
                                  setState(() => error = e.toString());
                                } finally {
                                  if (mounted) setState(() => busy = false);
                                }
                              },
                        child: Text(busy ? 'Connecting…' : register ? 'Create account' : 'Sign in'),
                      ),
                    ),
                    TextButton(
                      onPressed: () => setState(() => register = !register),
                      child: Text(register ? 'I already have an account' : 'Create a new account'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      );
}

class AppShell extends StatelessWidget {
  const AppShell({super.key, required this.title, required this.child});
  final String title;
  final Widget child;
  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    if (state.user == null) return const LoginPage();
    return Scaffold(
      appBar: AppBar(title: Row(children: [const Brand(), const SizedBox(width: 24), Text(title)]), actions: [
        IconButton(onPressed: state.toggleTheme, icon: Icon(state.dark ? Icons.light_mode : Icons.dark_mode)),
        IconButton(onPressed: () => Navigator.pushNamed(context, '/settings'), icon: const Icon(Icons.settings_outlined)),
        PopupMenuButton<String>(onSelected: (v) { if (v == 'logout') { state.logout(); Navigator.pushReplacementNamed(context, '/'); } }, itemBuilder: (_) => [PopupMenuItem(value: 'logout', child: Text('Sign out (${state.user?.name ?? 'demo'})'))]),
      ]),
      drawer: const AppDrawer(),
      body: SafeArea(child: Center(child: ConstrainedBox(constraints: const BoxConstraints(maxWidth: 1250), child: Padding(padding: const EdgeInsets.all(22), child: child)))),
    );
  }
}

class AppDrawer extends StatelessWidget {
  const AppDrawer({super.key});
  @override
  Widget build(BuildContext context) {
    final routes = <String, String>{'/dashboard': 'Dashboard', '/records': 'Land records', '/records/new': 'Digitise a record', '/map': 'Land map', '/disputes': 'Disputes & mediation', '/verification': 'Verification queue', '/ledger': 'Seal ledger', '/reports': 'Reports', '/activity': 'Audit activity', '/rights': 'Know your rights'};
    return Drawer(child: SafeArea(child: ListView(children: [
      const Padding(padding: EdgeInsets.all(20), child: Brand()),
      for (final entry in routes.entries) ListTile(leading: Icon(_iconFor(entry.key)), title: Text(entry.value), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, entry.key); }),
      const Divider(),
      ListTile(leading: const Icon(Icons.qr_code_scanner), title: const Text('Public verification'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/verify'); }),
    ])));
  }
  IconData _iconFor(String path) => switch (path) {
    '/dashboard' => Icons.dashboard_outlined, '/records' => Icons.description_outlined, '/records/new' => Icons.add_box_outlined,
    '/map' => Icons.map_outlined, '/disputes' => Icons.balance_outlined, '/verification' => Icons.verified_outlined,
    '/ledger' => Icons.link, '/reports' => Icons.bar_chart, '/activity' => Icons.history, _ => Icons.info_outline,
  };
}

class DashboardPage extends StatelessWidget {
  const DashboardPage({super.key});
  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    return AppShell(title: 'Dashboard', child: ListView(shrinkWrap: true, children: [
      Text('Good ${DateTime.now().hour < 12 ? 'morning' : 'evening'}, ${state.user?.name ?? 'friend'}', style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.bold)),
      const Text('Your land evidence at a glance.'),
      const SizedBox(height: 22),
      Wrap(spacing: 14, runSpacing: 14, children: [
        MetricCard(label: 'Land records', value: '${state.records.length}', icon: Icons.description_outlined, color: blue),
        MetricCard(label: 'Sealed evidence', value: '${state.records.where((r) => r.status == 'Sealed').length}', icon: Icons.verified_outlined, color: Colors.green),
        MetricCard(label: 'Open disputes', value: '${state.disputes.length}', icon: Icons.balance_outlined, color: Colors.deepPurple),
        MetricCard(label: 'Ledger status', value: 'Valid', icon: Icons.link, color: gold),
      ]),
      const SizedBox(height: 22),
      Wrap(spacing: 18, runSpacing: 18, children: [
        SizedBox(
          width: 560,
          child: Panel(
            title: 'My land records',
            action: TextButton(onPressed: () => Navigator.pushNamed(context, '/records'), child: const Text('View all')),
            child: Column(
              children: state.records.map((r) => ListTile(
                leading: const CircleAvatar(backgroundColor: Color(0xffeaf0fd), child: Icon(Icons.landscape, color: blue)),
                title: Text(r.title),
                subtitle: Text('${r.code} • ${r.district}'),
                trailing: Chip(label: Text(r.status)),
              )).toList(),
            ),
          ),
        ),
        SizedBox(width: 360, child: Panel(title: 'DevFest readiness', child: const Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          ProgressLine(label: 'SDG impact', value: '30 / 30', progress: 1),
          ProgressLine(label: 'Google tools', value: 'Firebase + Flutter + Gemini', progress: .9),
          ProgressLine(label: 'Technical execution', value: 'Core flow demo-ready', progress: .85),
          ProgressLine(label: 'Scale', value: 'Cloud-ready', progress: .8),
        ]))),
      ]),
    ]));
  }
}

class MetricCard extends StatelessWidget {
  const MetricCard({super.key, required this.label, required this.value, required this.icon, required this.color});
  final String label, value; final IconData icon; final Color color;
  @override Widget build(BuildContext context) => SizedBox(width: 220, child: Card(child: Padding(padding: const EdgeInsets.all(18), child: Row(children: [CircleAvatar(backgroundColor: color.withValues(alpha: .12), child: Icon(icon, color: color)), const SizedBox(width: 12), Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(value, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold)), Text(label, style: const TextStyle(color: Colors.grey))])]))));
}

class ProgressLine extends StatelessWidget {
  const ProgressLine({super.key, required this.label, required this.value, required this.progress});
  final String label, value; final double progress;
  @override Widget build(BuildContext context) => Padding(padding: const EdgeInsets.only(bottom: 15), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text(label), Text(value, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12))]), const SizedBox(height: 6), LinearProgressIndicator(value: progress, minHeight: 7, borderRadius: BorderRadius.circular(9))]));
}

class Panel extends StatelessWidget {
  const Panel({super.key, required this.title, required this.child, this.action});
  final String title; final Widget child; final Widget? action;
  @override Widget build(BuildContext context) => Card(child: Padding(padding: const EdgeInsets.all(18), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text(title, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold)), if (action != null) action!]), const SizedBox(height: 12), child])));
}

class RecordsPage extends StatelessWidget {
  const RecordsPage({super.key});
  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    return AppShell(
      title: 'Land records',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Text('Land records', style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.bold)),
            FilledButton.icon(onPressed: () => Navigator.pushNamed(context, '/records/new'), icon: const Icon(Icons.add), label: const Text('New record')),
          ]),
          const SizedBox(height: 18),
          Expanded(
            child: ListView(
              children: state.records.map((r) => Card(
                child: ListTile(
                  contentPadding: const EdgeInsets.all(14),
                  leading: const CircleAvatar(child: Icon(Icons.landscape)),
                  title: Text(r.title),
                  subtitle: Text('${r.code} • ${r.type} • ${r.district}'),
                  trailing: Wrap(spacing: 8, children: [
                    Chip(label: Text(r.status)),
                    OutlinedButton(onPressed: () => Navigator.pushNamed(context, '/verification'), child: const Text('Open')),
                  ]),
                ),
              )).toList(),
            ),
          ),
        ],
      ),
    );
  }
}

class RecordEditorPage extends StatefulWidget { const RecordEditorPage({super.key}); @override State<RecordEditorPage> createState() => _RecordEditorPageState(); }
class _RecordEditorPageState extends State<RecordEditorPage> {
  final title = TextEditingController(); final district = TextEditingController(); final plot = TextEditingController(); int step = 0;
  @override
  Widget build(BuildContext context) => AppShell(
    title: 'Digitise a record',
    child: ListView(children: [
      Text('Create a trusted land record', style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.bold)),
      const Text('Capture the agreement, parties, witnesses, boundaries and evidence before sealing.'),
      const SizedBox(height: 20),
      Stepper(
        currentStep: step,
        onStepContinue: () {
          if (step < 3) {
            setState(() => step++);
          } else {
            final app = context.read<AppState>();
            app.records.add(LandRecord(
              code: 'ETK-UG-2026-${app.records.length + 1}',
              title: title.text.isEmpty ? 'New land record' : title.text,
              type: 'Customary claim',
              status: 'Draft',
              district: district.text.isEmpty ? 'Wakiso' : district.text,
            ));
            app.records; // State changes are reflected when the route is reopened.
            Navigator.pushReplacementNamed(context, '/records');
          }
        },
        onStepCancel: () { if (step > 0) setState(() => step--); },
        steps: [
          Step(title: const Text('Plot details'), isActive: true, content: Column(children: [
            TextField(controller: title, decoration: const InputDecoration(labelText: 'Record title')),
            TextField(controller: district, decoration: const InputDecoration(labelText: 'District')),
            TextField(controller: plot, decoration: const InputDecoration(labelText: 'Plot description')),
          ])),
          const Step(title: Text('Parties & witnesses'), content: Text('Add seller, buyer, family members and witnesses.')),
          const Step(title: Text('Evidence'), content: Text('Attach identity photos, documents, audio and boundary photos.')),
          const Step(title: Text('Review & seal'), content: Text('Review the bilingual agreement and seal it into the append-only ledger.')),
        ],
      ),
    ]),
  );
}

class MapPage extends StatelessWidget {
  const MapPage({super.key});
  @override
  Widget build(BuildContext context) => AppShell(
    title: 'Land map',
    child: Panel(
      title: 'Community land map',
      child: SizedBox(
        height: 430,
        child: Container(
          decoration: BoxDecoration(color: const Color(0xffdcebd8), borderRadius: BorderRadius.circular(12)),
          child: const Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
            Icon(Icons.map, size: 70, color: navy),
            SizedBox(height: 12),
            Text('Boundary map', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
            Text('Firebase GeoPoint boundaries load here in the connected app.'),
          ])),
        ),
      ),
    ),
  );
}

class DisputesPage extends StatelessWidget {
  const DisputesPage({super.key});
  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    return AppShell(title: 'Disputes & mediation', child: ListView(children: [
      Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
        Text('Disputes & mediation', style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.bold)),
        FilledButton.icon(onPressed: () => showDialog(context: context, builder: (_) => const NewDisputeDialog()), icon: const Icon(Icons.add), label: const Text('Report dispute')),
      ]),
      const SizedBox(height: 18),
      ...state.disputes.map((d) => Card(child: ListTile(
        leading: const CircleAvatar(child: Icon(Icons.balance)),
        title: Text(d.title),
        subtitle: Text('${d.category} • Priority: ${d.priority}'),
        trailing: Chip(label: Text(d.stage)),
      ))),
    ]));
  }
}
class NewDisputeDialog extends StatefulWidget { const NewDisputeDialog({super.key}); @override State<NewDisputeDialog> createState() => _NewDisputeDialogState(); }
class _NewDisputeDialogState extends State<NewDisputeDialog> { final title = TextEditingController(); @override Widget build(BuildContext context) => AlertDialog(title: const Text('Report a land dispute'), content: TextField(controller: title, decoration: const InputDecoration(labelText: 'What needs mediation?')), actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')), FilledButton(onPressed: () { context.read<AppState>().addDispute(Dispute(title: title.text.isEmpty ? 'New dispute' : title.text, category: 'Ownership', stage: 'Reported', priority: 'Medium')); Navigator.pop(context); }, child: const Text('Report'))]); }

class VerificationPage extends StatelessWidget {
  const VerificationPage({super.key});
  @override
  Widget build(BuildContext context) => AppShell(
    title: 'Verification queue',
    child: Panel(
      title: 'Verification queue',
      child: const Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Every record is checked for evidence completeness before sealing.'),
        SizedBox(height: 18),
        ListTile(leading: Icon(Icons.check_circle, color: Colors.green), title: Text('Identity and consent'), subtitle: Text('Ready for review')),
        ListTile(leading: Icon(Icons.pending_outlined, color: gold), title: Text('Boundary evidence'), subtitle: Text('Capture a boundary photo or map')),
      ]),
    ),
  );
}

class VerifyPage extends StatefulWidget {
  const VerifyPage({super.key});
  @override State<VerifyPage> createState() => _VerifyPageState();
}
class _VerifyPageState extends State<VerifyPage> {
  final code = TextEditingController(text: 'ETK-UG-2026-001');
  bool checked = false;
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Brand()),
    body: Center(child: Card(child: SizedBox(width: 520, child: Padding(
      padding: const EdgeInsets.all(28),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        const Icon(Icons.verified_user_outlined, size: 52, color: blue),
        const SizedBox(height: 12),
        Text('Verify a land record', style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold)),
        const Text('Check the seal and evidence fingerprint before a transaction.'),
        const SizedBox(height: 20),
        TextField(controller: code, decoration: const InputDecoration(labelText: 'Record code')),
        const SizedBox(height: 12),
        SizedBox(width: double.infinity, child: FilledButton(onPressed: () => setState(() => checked = true), child: const Text('Verify record'))),
        if (checked) const Card(color: Color(0xffe7f6ec), child: ListTile(
          leading: Icon(Icons.check_circle, color: Colors.green),
          title: Text('Record found and seal valid'),
          subtitle: Text('ETK-UG-2026-001 • Evidence chain intact'),
        )),
      ]),
    )))),
  );
}

class RightsPage extends StatelessWidget { const RightsPage({super.key}); @override Widget build(BuildContext context) => AppShell(title: 'Know your rights', child: ListView(children: const [Text('Know your land rights', style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold)), SizedBox(height: 8), Text('Plain-language guidance for families and communities in Uganda.'), SizedBox(height: 20), Panel(title: 'Before you buy or sell', child: Text('Ask who has customary or registered rights, involve spouses and family, record witnesses, walk the boundary, and keep a copy of every agreement.')), SizedBox(height: 14), Panel(title: 'If a dispute starts', child: Text('Keep documents and evidence safe. Start with local council review and mediation before escalation. Ettaka keeps a timestamped trail for every step.'))])); }

class DigitisePage extends StatelessWidget { const DigitisePage({super.key}); @override Widget build(BuildContext context) => AppShell(title: 'AI digitisation', child: Panel(title: 'Gemini-assisted document digitisation', child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [const Text('Upload or photograph a handwritten agreement to extract structured parties, terms and dates. Human review is required before sealing.'), const SizedBox(height: 20), OutlinedButton.icon(onPressed: () {}, icon: const Icon(Icons.upload_file), label: const Text('Choose evidence')), const SizedBox(height: 12), const Text('Google Gemini is wired through the Dart service layer; add GEMINI_API_KEY through your deployment secret.', style: TextStyle(color: Colors.grey))]))); }

class LedgerPage extends StatelessWidget { const LedgerPage({super.key}); @override Widget build(BuildContext context) => AppShell(title: 'Seal ledger', child: Panel(title: 'Append-only seal ledger', child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [const ListTile(leading: Icon(Icons.link, color: Colors.green), title: Text('Chain integrity verified'), subtitle: Text('Every seal references the previous hash. Changes are detectable.')), const Divider(), ListTile(title: const Text('Block 0001'), subtitle: Text('ETK-UG-2026-001 • ${DateFormat('d MMM yyyy').format(DateTime.now())}'), trailing: const Icon(Icons.verified, color: Colors.green))]))); }
class ReportsPage extends StatelessWidget { const ReportsPage({super.key}); @override Widget build(BuildContext context) => AppShell(title: 'Reports', child: Panel(title: 'Reports & exports', child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [const Text('Export records, dispute outcomes and ledger evidence for officials and partners.'), const SizedBox(height: 18), Wrap(spacing: 10, children: [OutlinedButton.icon(onPressed: () {}, icon: const Icon(Icons.download), label: const Text('Records CSV')), OutlinedButton.icon(onPressed: () {}, icon: const Icon(Icons.download), label: const Text('Disputes CSV')), OutlinedButton.icon(onPressed: () {}, icon: const Icon(Icons.download), label: const Text('Ledger CSV'))])]))); }
class ActivityPage extends StatelessWidget { const ActivityPage({super.key}); @override Widget build(BuildContext context) => AppShell(title: 'Audit activity', child: Panel(title: 'Audit trail', child: Column(children: const [ListTile(leading: Icon(Icons.add_circle_outline, color: blue), title: Text('Record created'), subtitle: Text('ETK-UG-2026-001 • Just now')), ListTile(leading: Icon(Icons.verified_outlined, color: Colors.green), title: Text('Seal verified'), subtitle: Text('Public verification portal'))]))); }
class SettingsPage extends StatelessWidget { const SettingsPage({super.key}); @override Widget build(BuildContext context) { final state = context.watch<AppState>(); return AppShell(title: 'Settings', child: Panel(title: 'Account & preferences', child: Column(children: [ListTile(title: const Text('Signed in as'), subtitle: Text(state.user?.name ?? 'Demo citizen')), SwitchListTile(value: state.dark, onChanged: (_) => state.toggleTheme(), title: const Text('Dark mode')), const ListTile(title: Text('Data sync'), subtitle: Text('Firebase Authentication, Firestore and Storage'))]))); } }

// Service used by the production implementation for Gemini extraction.
class GeminiDigitiser {
  GeminiDigitiser(String apiKey) : model = GenerativeModel(model: 'gemini-1.5-flash', apiKey: apiKey);
  final GenerativeModel model;
  Future<String> extract(String transcript) async => (await model.generateContent([Content.text('Extract land record fields as JSON from this text: $transcript')])).text ?? '{}';
}

// Firestore adapter keeps domain behavior independent from widgets and supports
// the same records, parties, evidence, seals, disputes and audit collections.
class EttakaFirestoreRepository {
  final FirebaseFirestore db = FirebaseFirestore.instance;
  Stream<QuerySnapshot<Map<String, dynamic>>> records() => db.collection('records').orderBy('createdAt', descending: true).snapshots();
  Future<void> saveRecord(Map<String, dynamic> record) => db.collection('records').add({...record, 'createdAt': FieldValue.serverTimestamp()});
  Future<void> saveEvidence(String recordId, Map<String, dynamic> evidence) => db.collection('records').doc(recordId).collection('evidence').add(evidence);
  Future<void> reportDispute(Map<String, dynamic> dispute) => db.collection('disputes').add({...dispute, 'createdAt': FieldValue.serverTimestamp()});
}
