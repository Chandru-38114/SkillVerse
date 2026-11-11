"""Learning Rooms: access rules, host controls, chat and call signalling over the room socket."""
import unittest
from unittest import mock

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.database import Base, get_db
from backend.app import auth, models
from backend.app.routers import rooms


class RoomsTest(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
        db = self.Session()
        for i, n in [(1, "Host Hari"), (2, "Mia Member"), (3, "Ravi Random"), (4, "Zoe Extra")]:
            db.add(models.User(id=i, name=n, email=f"{i}@x.com", hashed_password="pw"))
        db.commit()
        db.close()
        rooms.hub.rooms.clear()
        rooms.hub.calls.clear()
        rooms._recent_runs.clear()

        app = FastAPI()
        app.include_router(rooms.router)
        self.current = 1

        def _db():
            d = self.Session()
            try:
                yield d
            finally:
                d.close()

        app.dependency_overrides[get_db] = _db
        app.dependency_overrides[auth.get_current_user] = lambda: self.Session().get(models.User, self.current)
        self.client = TestClient(app)
        self.patches = [
            mock.patch.object(rooms, "SessionLocal", self.Session),
            mock.patch.object(rooms.auth, "get_user_from_token",
                              lambda token, db: db.get(models.User, int(token))),
        ]
        for p in self.patches:
            p.start()

    def tearDown(self):
        for p in self.patches:
            p.stop()

    def as_user(self, uid):
        self.current = uid
        return self.client

    def _create(self, **kw):
        body = {"title": "DSA doubt clearing", "skill": "DSA", "visibility": "public", "max_participants": 3, **kw}
        r = self.as_user(1).post("/rooms", json=body)
        self.assertEqual(r.status_code, 200, r.text)
        return r.json()

    def test_public_room_listed_private_room_only_by_link(self):
        pub = self._create()
        priv = self._create(title="Private Java prep", visibility="private")
        listing = self.as_user(3).get("/rooms").json()
        self.assertEqual([r["code"] for r in listing["public"]], [pub["code"]])
        # The private room isn't listed, but its link works.
        self.assertEqual(self.as_user(3).get(f"/rooms/{priv['code']}").status_code, 200)
        self.assertEqual(self.as_user(3).post(f"/rooms/{priv['code']}/join").status_code, 200)
        mine = self.as_user(3).get("/rooms").json()["mine"]
        self.assertEqual([r["code"] for r in mine], [priv["code"]])

    def test_codes_are_unique_and_unguessable(self):
        codes = {self._create()["code"] for _ in range(5)}
        self.assertEqual(len(codes), 5)
        self.assertTrue(all(len(c) >= 12 for c in codes))

    def test_full_locked_and_removed(self):
        room = self._create()
        c = room["code"]
        self.assertEqual(self.as_user(2).post(f"/rooms/{c}/join").status_code, 200)
        self.assertEqual(self.as_user(3).post(f"/rooms/{c}/join").status_code, 200)
        self.assertEqual(self.as_user(4).post(f"/rooms/{c}/join").status_code, 409)       # max 3
        # Only the host manages the room.
        self.assertEqual(self.as_user(2).post(f"/rooms/{c}/remove/3").status_code, 403)
        self.assertEqual(self.as_user(1).post(f"/rooms/{c}/remove/3").status_code, 200)
        self.assertEqual(self.as_user(3).post(f"/rooms/{c}/join").status_code, 403)       # removed for good
        self.assertEqual(self.as_user(3).get(f"/rooms/{c}").status_code, 403)
        self.assertEqual(self.as_user(1).patch(f"/rooms/{c}", json={"status": "locked"}).status_code, 200)
        self.assertEqual(self.as_user(4).post(f"/rooms/{c}/join").status_code, 403)       # locked
        self.assertEqual(self.as_user(2).patch(f"/rooms/{c}", json={"title": "Hacked"}).status_code, 403)

    def test_members_only_for_board_code_messages_and_run(self):
        c = self._create()["code"]
        for path in ("messages", "whiteboard", "code"):
            self.assertEqual(self.as_user(3).get(f"/rooms/{c}/{path}").status_code, 403)
        self.assertEqual(self.as_user(3).post(f"/rooms/{c}/run", json={"code": "print(1)", "language": "python"}).status_code, 403)
        self.assertEqual(self.as_user(1).put(f"/rooms/{c}/whiteboard", json={"state": "[1]"}).status_code, 200)
        self.assertEqual(self.as_user(1).get(f"/rooms/{c}/whiteboard").json()["state"], "[1]")
        self.as_user(1).put(f"/rooms/{c}/code", json={"code": "x = 1", "language": "python"})
        self.as_user(1).put(f"/rooms/{c}/code", json={"code": "class A {}", "language": "java"})
        state = self.as_user(1).get(f"/rooms/{c}/code").json()
        self.assertEqual((state["language"], state["version"]), ("java", 2))
        self.assertEqual(state["drafts"]["python"], "x = 1")

    def test_run_is_rate_limited(self):
        c = self._create()["code"]
        fake = {"output": "1\n", "error": None, "status": "ok", "sql": None, "time_ms": 5}
        with mock.patch.object(rooms, "run_program", return_value=fake):
            codes = [self.as_user(1).post(f"/rooms/{c}/run", json={"code": "print(1)", "language": "python"}).status_code
                     for _ in range(21)]
        self.assertEqual(codes[:20], [200] * 20)
        self.assertEqual(codes[20], 429)

    def test_host_cannot_leave_and_close_hides_room(self):
        c = self._create()["code"]
        self.assertEqual(self.as_user(1).post(f"/rooms/{c}/leave").status_code, 400)
        self.assertEqual(self.as_user(1).delete(f"/rooms/{c}").status_code, 200)
        self.assertEqual(self.as_user(2).get(f"/rooms/{c}").status_code, 404)

    def test_socket_chat_and_call_signalling(self):
        c = self._create()["code"]
        self.as_user(2).post(f"/rooms/{c}/join")
        with self.client:   # one shared event loop for every socket, like the real server
            # Not a member -> 4403
            with self.client.websocket_connect(f"/rooms/ws/{c}?token=3") as ws:
                with self.assertRaises(Exception):
                    ws.receive_json()
            with self.client.websocket_connect(f"/rooms/ws/{c}?token=1") as host, \
                 self.client.websocket_connect(f"/rooms/ws/{c}?token=2") as mia:
                self.assertEqual(host.receive_json()["type"], "welcome")
                welcome = mia.receive_json()
                self.assertEqual((welcome["type"], welcome["host_id"]), ("welcome", 1))
                self.assertEqual(host.receive_json()["type"], "peer_joined")

                mia.send_json({"type": "chat", "text": "  Hello room!  "})
                for ws in (host, mia):
                    msg = ws.receive_json()
                    self.assertEqual((msg["type"], msg["text"], msg["name"]), ("chat", "Hello room!", "Mia Member"))

                # A member can't start the call; the host can.
                mia.send_json({"type": "call_start", "mode": "video"})
                host.send_json({"type": "call_start", "mode": "audio"})
                self.assertEqual(mia.receive_json(), {"type": "call_started", "mode": "audio", "by": 1})
                self.assertEqual(host.receive_json()["type"], "call_started")

                host.send_json({"type": "call_join"})
                self.assertEqual(host.receive_json(), {"type": "call_peers", "peers": [], "mode": "audio"})
                self.assertEqual(mia.receive_json(), {"type": "call_joined", "user_id": 1})
                mia.send_json({"type": "call_join"})
                self.assertEqual(mia.receive_json(), {"type": "call_peers", "peers": [1], "mode": "audio"})
                self.assertEqual(host.receive_json(), {"type": "call_joined", "user_id": 2})

                # Signalling goes only to the addressed person, tagged with the sender.
                mia.send_json({"type": "offer", "to": 1, "sdp": "x"})
                self.assertEqual(host.receive_json(), {"type": "offer", "to": 1, "sdp": "x", "from": 2})

                # Code and board updates reach everyone else.
                host.send_json({"type": "update_code", "code": "print(2)", "version": 5})
                self.assertEqual(mia.receive_json()["code"], "print(2)")

                # Host removes Mia: she gets "removed" and the host sees her leave the call.
                self.as_user(1).post(f"/rooms/{c}/remove/2")
                self.assertEqual(mia.receive_json()["type"], "removed")
                seen = [host.receive_json()["type"] for _ in range(2)]
                self.assertEqual(sorted(seen), ["call_left", "members_changed"])

        db = self.Session()
        self.assertEqual(db.query(models.RoomMessage).count(), 1)
        db.close()


if __name__ == "__main__":
    unittest.main()
