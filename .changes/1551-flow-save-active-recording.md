### Fixed

- **`@reticlehq/server` — `reticle_flow_save` names a recording that is still running.** Saving while the recording was active answered `flow_no_recording` with no hint why; it now names the active recording and the exact `reticle_record{action:"stop"}` call, and the tool description says it saves a stopped recording. Closes [#1551](https://github.com/reticlehq/reticle/issues/1551).
