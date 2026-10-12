"""A simple Python example demonstrating basic concepts."""


def greet(name: str) -> str:
    """Return a friendly greeting."""
    return f"Hello, {name}!"


def add(a: int, b: int) -> int:
    """Return the sum of two numbers."""
    return a + b


def main() -> None:
    print(greet("world"))
    print(f"2 + 3 = {add(2, 3)}")


if __name__ == "__main__":
    main()
