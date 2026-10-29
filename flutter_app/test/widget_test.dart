import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:ettaka/main.dart';

void main() {
  testWidgets('Ettaka landing page exposes the verification journey', (tester) async {
    await tester.pumpWidget(
      ChangeNotifierProvider(
        create: (_) => AppState(firebaseReady: false),
        child: const EttakaApp(),
      ),
    );

    expect(find.text('Land rights you can prove.'), findsOneWidget);
    expect(find.text('Verify a record'), findsOneWidget);
  });
}
