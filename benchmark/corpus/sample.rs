use std::collections::HashMap;

#[derive(Debug, Clone)]
struct User<'a> {
    name: &'a str,
    tags: Vec<String>,
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut users: HashMap<&str, User> = HashMap::new();
    users.insert(
        "ada",
        User {
            name: "Ada",
            tags: vec!["admin".into()],
        },
    );
    let raw = r#"{"enabled": true}"#;
    println!("{} {}", raw, users.len());
    Ok(())
}
