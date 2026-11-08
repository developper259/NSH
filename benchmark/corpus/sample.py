from dataclasses import dataclass


@dataclass
class User:
    name: str
    age: int = 0


def greet(user: User) -> str:
    """Return a greeting."""
    return f"Hello {user.name}"


if __name__ == "__main__":
    print(greet(User("Ada")))
