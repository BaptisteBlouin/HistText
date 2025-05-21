// Create a new file backend/server/utils.rs
use std::net::{Ipv4Addr, Ipv6Addr, SocketAddrV4, SocketAddrV6, TcpListener, ToSocketAddrs};
use std::ops::Range;

/// Binds a TcpListener to the given address
fn test_bind<A: ToSocketAddrs>(addr: A) -> bool {
    TcpListener::bind(addr)
        .map(|t| t.local_addr().is_ok())
        .unwrap_or(false)
}

/// Checks if the given port is free on this machine
pub fn is_port_free(port: u16) -> bool {
    let ipv4 = SocketAddrV4::new(Ipv4Addr::UNSPECIFIED, port);
    let ipv6 = SocketAddrV6::new(Ipv6Addr::UNSPECIFIED, port, 0, 0);

    test_bind(ipv6) && test_bind(ipv4)
}

/// Finds a free port in the given range
pub fn find_free_port(mut range: Range<u16>) -> Option<u16> {
    range.find(|port| is_port_free(*port))
}