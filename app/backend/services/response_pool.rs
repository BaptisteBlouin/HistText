use serde_json::Value;
use tokio::sync::{mpsc, oneshot};

pub struct ResponsePool {
    sender: mpsc::UnboundedSender<PooledResponse>,
}

struct PooledResponse {
    value: Value,
    size_estimate: usize,
    sender: oneshot::Sender<Value>,
}

impl ResponsePool {
    pub fn new() -> Self {
        let (tx, mut rx) = mpsc::unbounded_channel::<PooledResponse>();

        tokio::spawn(async move {
            let mut pool: Vec<Value> = Vec::with_capacity(100);

            while let Some(response) = rx.recv().await {
                if response.size_estimate < 1024 * 1024 && pool.len() < 100 {
                    pool.push(response.value.clone());
                }

                let _ = response.sender.send(response.value);
            }
        });

        Self { sender: tx }
    }

    pub async fn get_response(&self, value: Value) -> Value {
        let size_estimate = serde_json::to_string(&value).map(|s| s.len()).unwrap_or(0);

        let (tx, rx) = oneshot::channel();

        let pooled = PooledResponse {
            value: value.clone(),
            size_estimate,
            sender: tx,
        };

        if self.sender.send(pooled).is_ok() {
            rx.await.unwrap_or(value)
        } else {
            value
        }
    }
}

impl Default for ResponsePool {
    fn default() -> Self {
        Self::new()
    }
}
