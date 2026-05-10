import sqlite3
import json

conn = sqlite3.connect('backend/fluvius.db')
cursor = conn.cursor()
cursor.execute("SELECT event_type, payload FROM webhook_events WHERE event_type LIKE '%messages.update%' ORDER BY created_at DESC LIMIT 5")
rows = cursor.fetchall()

if not rows:
    # Let's check what events we actually have
    cursor.execute("SELECT DISTINCT event_type FROM webhook_events")
    events = cursor.fetchall()
    print("No messages.update events found.")
    print("Available event types in DB:", [e[0] for e in events])
else:
    for row in rows:
        print(f"Event: {row[0]}")
        payload = json.loads(row[1])
        print(json.dumps(payload, indent=2))
