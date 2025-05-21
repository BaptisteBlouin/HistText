// backend/template/spa.rs
use super::TEMPLATES;
use actix_web::{web, HttpRequest, HttpResponse, Scope};
use tera::Context;

pub struct SinglePageApplication {
    pub view_name: String,
}

#[allow(dead_code)]
pub fn render_single_page_application(route: &str, view: &str) -> Scope {
    use actix_web::web::Data;

    let route = route.strip_prefix('/').unwrap_or(route);
    let view = view.strip_prefix('/').unwrap_or(view);

    actix_web::web::scope(&format!("/{}{}", route, "{tail:(/.*)?}"))
        .app_data(Data::new(SinglePageApplication {
            view_name: view.to_string(),
        }))
        .route("", web::get().to(render_spa_handler))
}
#[allow(dead_code)]
async fn render_spa_handler(
    _req: HttpRequest,
    spa_info: web::Data<SinglePageApplication>,
) -> HttpResponse {
    let content = TEMPLATES
        .render(spa_info.view_name.as_str(), &Context::new())
        .unwrap_or_else(|e| {
            println!("Error rendering SPA template: {}", e);
            "<html><body>Error rendering template</body></html>".to_string()
        });

    HttpResponse::Ok().content_type("text/html").body(content)
}
