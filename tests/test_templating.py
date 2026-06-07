import pytest
from backend.query.templating import render, expand


def test_render_single():
    assert render("SELECT {{ col }} FROM t", {"col": "id"}) == "SELECT id FROM t"


def test_render_missing_key():
    with pytest.raises(KeyError):
        render("SELECT {{ col }} FROM t", {})


def test_expand_none():
    pairs = expand("SELECT 1", None)
    assert pairs == [("SELECT 1", {})]


def test_expand_dict():
    pairs = expand("SELECT {{ x }}", {"x": "1"})
    assert pairs == [("SELECT 1", {"x": "1"})]


def test_expand_list():
    pairs = expand("SELECT {{ x }}", [{"x": "a"}, {"x": "b"}])
    assert len(pairs) == 2
    assert pairs[0][0] == "SELECT a"
    assert pairs[1][0] == "SELECT b"
