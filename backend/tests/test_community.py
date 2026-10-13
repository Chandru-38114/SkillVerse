"""
Tests for TASK 4A: Teachers-Only Community & Lounge Feed.

Access Control:
- require_teacher helper uses teacher_stats_service: has_taught is true only if the user
  has at least one completed session as teacher.
- GET /community/access returns {"has_taught": bool} so frontend can show a locked state.
- Non-teachers receive 403 on every lounge endpoint.

Lounge Feed:
- Qualifying teachers can post, list, view, comment, and delete.
- Deletion permissions: post deletion is author-only. Comment deletion is allowed
  by either the comment author or the parent post author.
- Non-authors cannot delete someone else's post or comment.
- Pagination returns posts newest-first with author details and comment_count.
- Abuse guard: rate-limit of 30 seconds between posts per user is enforced (HTTP 429).
"""
import unittest
import datetime as dt
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app.database import Base
from backend.app import models, schemas
from backend.app.routers.community import (
    require_teacher,
    get_community_access,
    create_lounge_post,
    get_lounge_posts,
    get_lounge_post_detail,
    create_lounge_comment,
    delete_lounge_post,
    delete_lounge_comment,
)
from backend.app.services.teacher_stats_service import check_user_has_taught
from backend.app.utils.timezone import utc_now


class TestCommunityLounge(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

        # Users:
        # alice: qualified teacher (completed session as tutor)
        self.alice = models.User(
            id=1,
            email="alice@teachers.edu",
            name="Alice Smith",
            college="MIT",
            hashed_password="pw",
            points=150,
        )
        # bob: qualified teacher (completed session as tutor)
        self.bob = models.User(
            id=2,
            email="bob@teachers.edu",
            name="Bob Jones",
            college="Stanford",
            hashed_password="pw",
            points=120,
        )
        # charlie: qualified teacher (completed session as tutor)
        self.charlie = models.User(
            id=3,
            email="charlie@teachers.edu",
            name="Charlie Brown",
            college="Harvard",
            hashed_password="pw",
            points=110,
        )
        # daisy: learner only (has attended sessions as learner, NEVER taught a completed session)
        self.daisy = models.User(
            id=4,
            email="daisy@students.edu",
            name="Daisy Miller",
            college="Oxford",
            hashed_password="pw",
            points=90,
        )
        # eve: newly registered user (zero sessions in system)
        self.eve = models.User(
            id=5,
            email="eve@freshman.edu",
            name="Eve Torres",
            college="Cambridge",
            hashed_password="pw",
            points=100,
        )

        self.skill_python = models.Skill(id=1, name="Python")
        self.skill_react = models.Skill(id=2, name="React")

        self.db.add_all([
            self.alice, self.bob, self.charlie, self.daisy, self.eve,
            self.skill_python, self.skill_react,
        ])
        self.db.commit()

        # Connection Requests
        req1 = models.ConnectionRequest(id=1, from_user_id=self.daisy.id, to_user_id=self.alice.id, skill_id=1, status="completed", points_awarded=True)
        req2 = models.ConnectionRequest(id=2, from_user_id=self.daisy.id, to_user_id=self.bob.id, skill_id=2, status="completed", points_awarded=True)
        req3 = models.ConnectionRequest(id=3, from_user_id=self.daisy.id, to_user_id=self.charlie.id, skill_id=1, status="completed", points_awarded=True)
        req4 = models.ConnectionRequest(id=4, from_user_id=self.eve.id, to_user_id=self.daisy.id, skill_id=1, status="cancelled")
        self.db.add_all([req1, req2, req3, req4])
        self.db.commit()

        # Seed completed teaching sessions:
        # Session 1: Alice taught Daisy (completed) -> Alice qualifies as teacher
        sess1 = models.Session(
            id=1,
            request_id=req1.id,
            tutor_id=self.alice.id,
            learner_id=self.daisy.id,
            skill="Python",
            status="completed",
            session_date="2026-03-01",
            start_time="10:00",
            end_time="11:00",
            created_at=utc_now() - dt.timedelta(days=10),
        )
        # Session 2: Bob taught Daisy (completed) -> Bob qualifies as teacher
        sess2 = models.Session(
            id=2,
            request_id=req2.id,
            tutor_id=self.bob.id,
            learner_id=self.daisy.id,
            skill="React",
            status="completed",
            session_date="2026-03-05",
            start_time="14:00",
            end_time="15:00",
            created_at=utc_now() - dt.timedelta(days=7),
        )
        # Session 3: Charlie taught Daisy (completed) -> Charlie qualifies as teacher
        sess3 = models.Session(
            id=3,
            request_id=req3.id,
            tutor_id=self.charlie.id,
            learner_id=self.daisy.id,
            skill="Python",
            status="completed",
            session_date="2026-03-08",
            start_time="09:00",
            end_time="10:00",
            created_at=utc_now() - dt.timedelta(days=5),
        )
        # Session 4: Daisy was a tutor for Eve but it was CANCELLED (not completed!) -> Daisy does NOT qualify
        sess4 = models.Session(
            id=4,
            request_id=req4.id,
            tutor_id=self.daisy.id,
            learner_id=self.eve.id,
            skill="Python",
            status="cancelled",
            session_date="2026-03-09",
            start_time="16:00",
            end_time="17:00",
            created_at=utc_now() - dt.timedelta(days=2),
        )

        self.db.add_all([sess1, sess2, sess3, sess4])
        self.db.commit()

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(self.engine)

    # ── 1. Access Control Tests ──────────────────────────────────────────────

    def test_has_taught_gate_criteria(self):
        """Only users with at least one completed session as teacher qualify."""
        self.assertTrue(check_user_has_taught(self.db, self.alice.id))
        self.assertTrue(check_user_has_taught(self.db, self.bob.id))
        self.assertTrue(check_user_has_taught(self.db, self.charlie.id))
        # Daisy has learner sessions and one cancelled tutor session -> False
        self.assertFalse(check_user_has_taught(self.db, self.daisy.id))
        # Eve has 0 sessions -> False
        self.assertFalse(check_user_has_taught(self.db, self.eve.id))

    def test_access_check_endpoint_returns_boolean_without_403(self):
        """GET /community/access returns has_taught bool so frontend avoids 403 walls."""
        # Non-teacher Daisy
        access_daisy = get_community_access(current_user=self.daisy, db=self.db)
        self.assertFalse(access_daisy.has_taught)

        # Fresh user Eve
        access_eve = get_community_access(current_user=self.eve, db=self.db)
        self.assertFalse(access_eve.has_taught)

        # Qualified teacher Alice
        access_alice = get_community_access(current_user=self.alice, db=self.db)
        self.assertTrue(access_alice.has_taught)

    def test_non_teacher_gets_403_on_every_lounge_endpoint(self):
        """Every lounge endpoint rejects non-teachers with HTTP 403."""
        # Setup an existing post and comment created by Alice
        post = models.LoungePost(
            id=10,
            author_id=self.alice.id,
            body="Lesson plan sharing",
            created_at=utc_now() - dt.timedelta(hours=2),
        )
        self.db.add(post)
        self.db.commit()

        comment = models.LoungeComment(
            id=20,
            post_id=post.id,
            author_id=self.alice.id,
            body="First comment",
            created_at=utc_now() - dt.timedelta(hours=1),
        )
        self.db.add(comment)
        self.db.commit()

        # 1. Dependency require_teacher directly
        with self.assertRaises(HTTPException) as ctx:
            require_teacher(current_user=self.daisy, db=self.db)
        self.assertEqual(ctx.exception.status_code, 403)

        with self.assertRaises(HTTPException) as ctx:
            require_teacher(current_user=self.eve, db=self.db)
        self.assertEqual(ctx.exception.status_code, 403)

        # 2. POST /community/lounge/posts
        with self.assertRaises(HTTPException) as ctx:
            create_lounge_post(
                payload=schemas.LoungePostCreate(body="Student trying to post"),
                current_user=require_teacher(current_user=self.daisy, db=self.db),
                db=self.db,
            )
        self.assertEqual(ctx.exception.status_code, 403)

        # 3. GET /community/lounge/posts
        with self.assertRaises(HTTPException) as ctx:
            get_lounge_posts(
                current_user=require_teacher(current_user=self.daisy, db=self.db),
                db=self.db,
            )
        self.assertEqual(ctx.exception.status_code, 403)

        # 4. GET /community/lounge/posts/{id}
        with self.assertRaises(HTTPException) as ctx:
            get_lounge_post_detail(
                id=post.id,
                current_user=require_teacher(current_user=self.daisy, db=self.db),
                db=self.db,
            )
        self.assertEqual(ctx.exception.status_code, 403)

        # 5. POST /community/lounge/posts/{id}/comments
        with self.assertRaises(HTTPException) as ctx:
            create_lounge_comment(
                id=post.id,
                payload=schemas.LoungeCommentCreate(body="Student trying to comment"),
                current_user=require_teacher(current_user=self.daisy, db=self.db),
                db=self.db,
            )
        self.assertEqual(ctx.exception.status_code, 403)

        # 6. DELETE /community/lounge/posts/{id}
        with self.assertRaises(HTTPException) as ctx:
            delete_lounge_post(
                id=post.id,
                current_user=require_teacher(current_user=self.daisy, db=self.db),
                db=self.db,
            )
        self.assertEqual(ctx.exception.status_code, 403)

        # 7. DELETE /community/lounge/comments/{id}
        with self.assertRaises(HTTPException) as ctx:
            delete_lounge_comment(
                id=comment.id,
                current_user=require_teacher(current_user=self.daisy, db=self.db),
                db=self.db,
            )
        self.assertEqual(ctx.exception.status_code, 403)

    # ── 2. Qualifying Teacher CRUD Flow ──────────────────────────────────────

    def test_qualifying_teacher_full_crud_flow(self):
        """A qualifying teacher can post, list, view, comment, and delete their own post/comment."""
        # 1. Alice creates a post
        post_payload = schemas.LoungePostCreate(body="Great strategies for teaching recursion in Python.")
        post = create_lounge_post(payload=post_payload, current_user=self.alice, db=self.db)
        self.assertIsNotNone(post.id)
        self.assertEqual(post.author_id, self.alice.id)
        self.assertEqual(post.author_name, "Alice Smith")
        self.assertEqual(post.author_college, "MIT")
        self.assertEqual(post.comment_count, 0)
        self.assertEqual(post.body, "Great strategies for teaching recursion in Python.")

        # 2. Bob lists posts
        posts_list = get_lounge_posts(current_user=self.bob, db=self.db)
        self.assertEqual(len(posts_list), 1)
        self.assertEqual(posts_list[0].id, post.id)
        self.assertEqual(posts_list[0].author_name, "Alice Smith")
        self.assertEqual(posts_list[0].comment_count, 0)

        # 3. Bob comments on Alice's post
        comment_payload = schemas.LoungeCommentCreate(body="I usually draw tree diagrams with students!")
        comment = create_lounge_comment(
            id=post.id,
            payload=comment_payload,
            current_user=self.bob,
            db=self.db,
        )
        self.assertIsNotNone(comment.id)
        self.assertEqual(comment.post_id, post.id)
        self.assertEqual(comment.author_id, self.bob.id)
        self.assertEqual(comment.author_name, "Bob Jones")

        # 4. Charlie views post detail
        detail = get_lounge_post_detail(id=post.id, current_user=self.charlie, db=self.db)
        self.assertEqual(detail.id, post.id)
        self.assertEqual(detail.comment_count, 1)
        self.assertEqual(len(detail.comments), 1)
        self.assertEqual(detail.comments[0].id, comment.id)
        self.assertEqual(detail.comments[0].body, "I usually draw tree diagrams with students!")

        # 5. Bob deletes his own comment
        res_del_comment = delete_lounge_comment(id=comment.id, current_user=self.bob, db=self.db)
        self.assertEqual(res_del_comment["status"], "success")

        # Verify comment is removed
        detail_after_c_del = get_lounge_post_detail(id=post.id, current_user=self.alice, db=self.db)
        self.assertEqual(detail_after_c_del.comment_count, 0)
        self.assertEqual(len(detail_after_c_del.comments), 0)

        # 6. Alice deletes her own post
        res_del_post = delete_lounge_post(id=post.id, current_user=self.alice, db=self.db)
        self.assertEqual(res_del_post["status"], "success")

        # Verify post is removed
        posts_after_p_del = get_lounge_posts(current_user=self.alice, db=self.db)
        self.assertEqual(len(posts_after_p_del), 0)

    # ── 3. Deletion Permissions & Moderation ─────────────────────────────────

    def test_non_author_cannot_delete_someone_elses_post(self):
        """A teacher who did not author a post cannot delete it."""
        post = models.LoungePost(
            id=101,
            author_id=self.alice.id,
            body="Alice's exclusive insights",
            created_at=utc_now(),
        )
        self.db.add(post)
        self.db.commit()

        # Bob attempts to delete Alice's post -> 403 Forbidden
        with self.assertRaises(HTTPException) as ctx:
            delete_lounge_post(id=post.id, current_user=self.bob, db=self.db)
        self.assertEqual(ctx.exception.status_code, 403)
        self.assertIn("Only the post author can delete it", ctx.exception.detail)

        # Confirm post still exists
        self.assertIsNotNone(self.db.query(models.LoungePost).filter_by(id=post.id).first())

    def test_comment_deletion_rules(self):
        """
        Comment author can delete their comment.
        Post author can delete any comment on their own post (thread moderation).
        A third teacher cannot delete someone else's comment on another teacher's post.
        """
        post = models.LoungePost(
            id=102,
            author_id=self.alice.id,
            body="Alice's post on testing",
            created_at=utc_now(),
        )
        self.db.add(post)
        self.db.commit()

        # Bob writes comment 1 on Alice's post
        c1 = models.LoungeComment(
            id=201,
            post_id=post.id,
            author_id=self.bob.id,
            body="Bob's comment",
            created_at=utc_now(),
        )
        # Charlie writes comment 2 on Alice's post
        c2 = models.LoungeComment(
            id=202,
            post_id=post.id,
            author_id=self.charlie.id,
            body="Charlie's comment",
            created_at=utc_now(),
        )
        self.db.add_all([c1, c2])
        self.db.commit()

        # 1. Charlie (third party) tries to delete Bob's comment c1 -> 403
        with self.assertRaises(HTTPException) as ctx:
            delete_lounge_comment(id=c1.id, current_user=self.charlie, db=self.db)
        self.assertEqual(ctx.exception.status_code, 403)

        # 2. Alice (post author) deletes Charlie's comment c2 -> allowed (thread host moderation)
        res_host = delete_lounge_comment(id=c2.id, current_user=self.alice, db=self.db)
        self.assertEqual(res_host["status"], "success")
        self.assertIsNone(self.db.query(models.LoungeComment).filter_by(id=c2.id).first())

        # 3. Bob (comment author) deletes his own comment c1 -> allowed
        res_own = delete_lounge_comment(id=c1.id, current_user=self.bob, db=self.db)
        self.assertEqual(res_own["status"], "success")
        self.assertIsNone(self.db.query(models.LoungeComment).filter_by(id=c1.id).first())

    # ── 4. Pagination & Ordering ─────────────────────────────────────────────

    def test_pagination_and_newest_first_ordering(self):
        """Posts are returned in descending chronological order with accurate limit/offset."""
        base_time = utc_now() - dt.timedelta(hours=10)
        # Seed 5 posts from Alice and Bob with staggered timestamps
        posts = [
            models.LoungePost(
                id=301 + i,
                author_id=self.alice.id if i % 2 == 0 else self.bob.id,
                body=f"Post number {i + 1}",
                created_at=base_time + dt.timedelta(minutes=i * 15),
            )
            for i in range(5)
        ]
        self.db.add_all(posts)
        self.db.commit()

        # Page 1: limit 2, offset 0 -> expects posts 5 and 4 (ids 305, 304)
        p1 = get_lounge_posts(limit=2, offset=0, current_user=self.alice, db=self.db)
        self.assertEqual(len(p1), 2)
        self.assertEqual([p.id for p in p1], [305, 304])

        # Page 2: limit 2, offset 2 -> expects posts 3 and 2 (ids 303, 302)
        p2 = get_lounge_posts(limit=2, offset=2, current_user=self.alice, db=self.db)
        self.assertEqual(len(p2), 2)
        self.assertEqual([p.id for p in p2], [303, 302])

        # Page 3: limit 2, offset 4 -> expects post 1 (id 301)
        p3 = get_lounge_posts(limit=2, offset=4, current_user=self.alice, db=self.db)
        self.assertEqual(len(p3), 1)
        self.assertEqual(p3[0].id, 301)

        # Support 'skip' query param synonym as well
        p_skip = get_lounge_posts(limit=2, offset=0, skip=2, current_user=self.alice, db=self.db)
        self.assertEqual([p.id for p in p_skip], [303, 302])

    # ── 5. Rate Limiting Abuse Guard ─────────────────────────────────────────

    def test_posting_rate_limit_enforced_on_rapid_double_post(self):
        """A user cannot post more than once every 30 seconds (HTTP 429)."""
        # First post succeeds
        payload1 = schemas.LoungePostCreate(body="Initial discussion thread")
        p1 = create_lounge_post(payload=payload1, current_user=self.alice, db=self.db)
        self.assertIsNotNone(p1.id)

        # Immediate second post by Alice fails with HTTP 429
        payload2 = schemas.LoungePostCreate(body="Rapid accidental double click submit")
        with self.assertRaises(HTTPException) as ctx:
            create_lounge_post(payload=payload2, current_user=self.alice, db=self.db)
        self.assertEqual(ctx.exception.status_code, 429)
        self.assertIn("Rate limit exceeded", ctx.exception.detail)

        # Another teacher (Bob) CAN post without being affected by Alice's cooldown
        payload_bob = schemas.LoungePostCreate(body="Bob's independent post")
        p_bob = create_lounge_post(payload=payload_bob, current_user=self.bob, db=self.db)
        self.assertIsNotNone(p_bob.id)

    # ── 6. Validation & Edge Cases ───────────────────────────────────────────

    def test_post_and_comment_validation_constraints(self):
        """Body must not be empty or exceed length limits (2000 chars for post, 1000 for comment)."""
        # 1. Empty or whitespace post body
        with self.assertRaises(ValidationError):
            schemas.LoungePostCreate(body="   ")

        # 2. Post body over 2000 chars
        with self.assertRaises(ValidationError):
            schemas.LoungePostCreate(body="X" * 2001)

        # 3. Empty or whitespace comment body
        with self.assertRaises(ValidationError):
            schemas.LoungeCommentCreate(body="   ")

        # 4. Comment body over 1000 chars
        with self.assertRaises(ValidationError):
            schemas.LoungeCommentCreate(body="C" * 1001)

    def test_not_found_errors_for_missing_post_or_comment(self):
        """404 returned when accessing or deleting non-existent post/comment."""
        with self.assertRaises(HTTPException) as ctx:
            get_lounge_post_detail(id=9999, current_user=self.alice, db=self.db)
        self.assertEqual(ctx.exception.status_code, 404)

        with self.assertRaises(HTTPException) as ctx:
            delete_lounge_post(id=9999, current_user=self.alice, db=self.db)
        self.assertEqual(ctx.exception.status_code, 404)

        with self.assertRaises(HTTPException) as ctx:
            create_lounge_comment(
                id=9999,
                payload=schemas.LoungeCommentCreate(body="Valid body"),
                current_user=self.alice,
                db=self.db,
            )
        self.assertEqual(ctx.exception.status_code, 404)

        with self.assertRaises(HTTPException) as ctx:
            delete_lounge_comment(id=9999, current_user=self.alice, db=self.db)
        self.assertEqual(ctx.exception.status_code, 404)
