# tests/test_database.py
import pytest
from unittest.mock import patch, MagicMock
import importlib
from app.database import get_db

class TestDatabaseConnection:
    """Test class for database connection."""
    
    @pytest.mark.database
    def test_database_engine_creation(self, monkeypatch):
        """Test that the database engine is created with the correct URL."""
        mock_settings = MagicMock()
        mock_settings.database_url = "postgresql://test:test@localhost/testdb"
        monkeypatch.setattr('app.config.settings', mock_settings)

        with patch('sqlalchemy.create_engine') as mock_create_engine:
            mock_engine = MagicMock()
            mock_create_engine.return_value = mock_engine

            from app import database
            importlib.reload(database)
            mock_create_engine.assert_called_once_with(mock_settings.database_url)
        assert database.engine is mock_engine

    @pytest.mark.database
    def test_get_db_session_handling(self, mock_db_session: MagicMock):
        """Test that get_db creates, yields, and closes a session correctly."""
        db_generator = get_db()
        db = next(db_generator)

        assert db is mock_db_session
        mock_db_session.close.assert_not_called()

        with pytest.raises(StopIteration):
            next(db_generator)

        mock_db_session.close.assert_called_once()

    @pytest.mark.database
    def test_get_db_closes_session_on_exception(self, mock_db_session: MagicMock):
        """Test that the session is closed even when an exception occurs."""
        db_generator = get_db()
        db = next(db_generator)

        assert db is mock_db_session

        with pytest.raises(ValueError, match="Test Exception"):
            try:
                raise ValueError("Test Exception")
            finally:
                with pytest.raises(StopIteration):
                    next(db_generator)
        mock_db_session.close.assert_called_once()
