// Update .cargo/bin/frontend.rs
use std::{net::{Ipv4Addr, Ipv6Addr, SocketAddrV4, SocketAddrV6, TcpListener, ToSocketAddrs}, path::PathBuf, process::Command};

#[cfg(windows)]
pub const NPM: &'static str = "npm.cmd";

#[cfg(not(windows))]
pub const NPM: &str = "npm";

// Copy the port checking functionality directly into this file
fn test_bind<A: ToSocketAddrs>(addr: A) -> bool {
    TcpListener::bind(addr)
        .map(|t| t.local_addr().is_ok())
        .unwrap_or(false)
}

pub fn is_port_free(port: u16) -> bool {
    let ipv4 = SocketAddrV4::new(Ipv4Addr::UNSPECIFIED, port);
    let ipv6 = SocketAddrV6::new(Ipv6Addr::UNSPECIFIED, port, 0, 0);

    test_bind(ipv6) && test_bind(ipv4)
}

pub fn main() {
    if !is_port_free(21012) {
        println!("========================================================");
        println!(" ViteJS (the frontend compiler/bundler) needs to run on");
        println!(" port 21012 but it seems to be in use.");
        println!("========================================================");
        panic!("Port 21012 is taken but is required for development!")
    }

    let dir = env!("CARGO_MANIFEST_DIR");

    Command::new(NPM)
        .args(["run", "start:dev"])
        .current_dir(PathBuf::from_iter([dir, "frontend"]))
        .spawn()
        .unwrap()
        .wait_with_output()
        .unwrap();
}