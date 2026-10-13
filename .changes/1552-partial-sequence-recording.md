### Fixed

- **`@reticlehq/server` — stalled `reticle_act` sequences now retain their completed prefix.** A sequence that reached a missing target used to discard earlier successful actions when its recording was stopped; recordings now contain only the actions that ran before the stall, with only expectations that held. Closes [#1552](https://github.com/reticlehq/reticle/issues/1552).
