from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, AsyncGenerator
from enum import Enum
import uuid


class ConnectionStatus(str, Enum):
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    ERROR = "error"


@dataclass
class ConnectionInfo:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = ""
    type: str = ""
    status: ConnectionStatus = ConnectionStatus.DISCONNECTED
    config: dict = field(default_factory=dict)
    error: str | None = None


class BaseConnector(ABC):
    def __init__(self, connection_info: ConnectionInfo):
        self.info = connection_info

    @abstractmethod
    async def connect(self) -> None: ...

    @abstractmethod
    async def disconnect(self) -> None: ...

    @abstractmethod
    async def execute(
        self, sql: str, params: dict | None = None
    ) -> AsyncGenerator[dict[str, Any], None]: ...

    @abstractmethod
    async def cancel(self, execution_id: str) -> None: ...

    @abstractmethod
    async def get_databases(self) -> list[str]: ...

    @abstractmethod
    async def get_schemas(self, database: str) -> list[str]: ...

    @abstractmethod
    async def get_tables(self, database: str, schema: str) -> list[dict]: ...

    @abstractmethod
    async def get_columns(self, database: str, schema: str, table: str) -> list[dict]: ...
