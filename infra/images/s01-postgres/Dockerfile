ARG PARENT_IMAGE
FROM ${PARENT_IMAGE}
RUN --network=none --mount=type=bind,source=packages,target=/tmp/s01-packages,readonly \
    apk --no-network --repositories-file /dev/null verify \
      /tmp/s01-packages/libcrypto3.apk /tmp/s01-packages/libssl3.apk /tmp/s01-packages/libxml2.apk && \
    apk --no-network --repositories-file /dev/null add --no-cache --scripts=no \
      /tmp/s01-packages/libcrypto3.apk /tmp/s01-packages/libssl3.apk /tmp/s01-packages/libxml2.apk
