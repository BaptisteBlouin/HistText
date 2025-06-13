use diesel::deserialize::{self, FromSql};
use diesel::pg::{Pg, PgValue};
use diesel::serialize::{self, IsNull, Output, ToSql};
use diesel::sql_types::Jsonb;
use diesel::{AsExpression, FromSqlRow};
use serde_json::Value as JsonValue;
use std::io::Write;

#[derive(Debug, Clone, PartialEq, FromSqlRow, AsExpression)]
#[diesel(sql_type = Jsonb)]
pub struct JsonbValue(pub JsonValue);

impl ToSql<Jsonb, Pg> for JsonbValue {
    fn to_sql<'b>(&'b self, out: &mut Output<'b, '_, Pg>) -> serialize::Result {
        let json_str = serde_json::to_string(&self.0)?;
        out.write_all(json_str.as_bytes())?;
        Ok(IsNull::No)
    }
}

impl FromSql<Jsonb, Pg> for JsonbValue {
    fn from_sql(bytes: PgValue<'_>) -> deserialize::Result<Self> {
        let json_str = std::str::from_utf8(bytes.as_bytes())?;
        let json_value: JsonValue = serde_json::from_str(json_str)?;
        Ok(JsonbValue(json_value))
    }
}

impl From<JsonValue> for JsonbValue {
    fn from(value: JsonValue) -> Self {
        JsonbValue(value)
    }
}

impl From<JsonbValue> for JsonValue {
    fn from(value: JsonbValue) -> Self {
        value.0
    }
}
