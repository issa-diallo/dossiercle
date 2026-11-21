ARG PARENT_IMAGE
FROM ${PARENT_IMAGE}
USER root
RUN --network=none --mount=type=bind,source=libxml2.apk,target=/tmp/libxml2.apk,readonly \
    apk --no-network --repositories-file /dev/null verify /tmp/libxml2.apk && \
    apk --no-network --repositories-file /dev/null add --no-cache --scripts=no /tmp/libxml2.apk && \
    test "$(readlink /usr/lib/libxml2.so.2)" = libxml2.so.2.13.9
USER nginx
