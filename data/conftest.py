"""pytest fixtures shared across data parser tests."""
from pathlib import Path
import pytest

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"


@pytest.fixture
def fy27_budget_text():
    return (DATA / "FY27_Proposed_Budget_No_Override.txt").read_text()


@pytest.fixture
def school_packet_text():
    return (DATA / "schools" / "sc-meetings-fy26"
            / "agenda-and-materials-2-5-2026-fy27-budget-packet.txt").read_text()
