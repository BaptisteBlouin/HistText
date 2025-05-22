use crate::services::auth::Auth;
use async_graphql::{Context, Object};

pub struct QueryRoot;

#[Object]
impl QueryRoot {
    async fn ping(&self, ctx: &Context<'_>) -> String {
        let auth = ctx.data::<Auth>().unwrap();
        format!("Hello user#{}", auth.user_id)
    }
}
