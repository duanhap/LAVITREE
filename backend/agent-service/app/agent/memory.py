import time
import threading
from typing import Dict, List, Optional
from dataclasses import dataclass, field


@dataclass
class ConversationTurn:
    user_message: str
    agent_response: str
    timestamp: float = field(default_factory=time.time)


class InactivitySession:
    def __init__(self, conversation_id: str, max_turns: int = 3, ttl_seconds: int = 3600):
        self.conversation_id = conversation_id
        self.max_turns = max_turns
        self.ttl_seconds = ttl_seconds
        self.turns: List[ConversationTurn] = []
        self.last_accessed_at = time.time()

    def add_turn(self, user_message: str, agent_response: str) -> None:
        self.turns.append(ConversationTurn(user_message=user_message, agent_response=agent_response))
        if len(self.turns) > self.max_turns:
            self.turns = self.turns[-self.max_turns:]
        self.last_accessed_at = time.time()

    def get_turns(self) -> List[ConversationTurn]:
        self.last_accessed_at = time.time()
        return list(self.turns)

    def is_expired(self) -> bool:
        return (time.time() - self.last_accessed_at) > self.ttl_seconds


class ShortTermMemory:
    """
    Bộ nhớ ngắn hạn phiên hội thoại (In-Memory STM — Rolling Window Context).
    Quản lý K=3 lượt trao đổi gần nhất theo conversation_id, tự hủy sau TTL=1 giờ (3600s).
    Giới hạn tối đa 1.000 phiên trong RAM, tự dọn dẹp theo cơ chế LRU để chống tràn bộ nhớ.
    Thread-safe, bảo vệ chống tranh chấp tài nguyên khi nhiều request cùng xử lý.
    """
    def __init__(self, max_turns: int = 3, ttl_seconds: int = 3600, max_sessions: int = 1000):
        self._max_turns = max_turns
        self._ttl_seconds = ttl_seconds
        self._max_sessions = max_sessions
        self._sessions: Dict[str, InactivitySession] = {}
        self._lock = threading.Lock()

    def add_turn(self, conversation_id: str, user_message: str, agent_response: str) -> None:
        if not conversation_id:
            return
        with self._lock:
            self._cleanup_expired_locked()

            # Giới hạn số lượng phiên trong bộ nhớ
            if len(self._sessions) >= self._max_sessions and conversation_id not in self._sessions:
                # Loại bỏ phiên cũ nhất theo last_accessed_at
                oldest_cid = min(self._sessions.keys(), key=lambda cid: self._sessions[cid].last_accessed_at)
                del self._sessions[oldest_cid]

            if conversation_id not in self._sessions:
                self._sessions[conversation_id] = InactivitySession(
                    conversation_id=conversation_id,
                    max_turns=self._max_turns,
                    ttl_seconds=self._ttl_seconds
                )
            self._sessions[conversation_id].add_turn(user_message, agent_response)

    def get_history(self, conversation_id: str) -> List[Dict[str, str]]:
        if not conversation_id:
            return []
        with self._lock:
            self._cleanup_expired_locked()
            session = self._sessions.get(conversation_id)
            if not session:
                return []
            history = []
            for t in session.get_turns():
                history.append({"role": "user", "content": t.user_message})
                history.append({"role": "assistant", "content": t.agent_response})
            return history

    def clear(self, conversation_id: str) -> None:
        with self._lock:
            if conversation_id in self._sessions:
                del self._sessions[conversation_id]

    def _cleanup_expired_locked(self) -> None:
        now = time.time()
        expired_ids = [
            cid for cid, s in self._sessions.items()
            if (now - s.last_accessed_at) > self._ttl_seconds
        ]
        for cid in expired_ids:
            del self._sessions[cid]


# Singleton instance toàn cục của bộ nhớ STM
stm_memory = ShortTermMemory(max_turns=3, ttl_seconds=3600, max_sessions=1000)
