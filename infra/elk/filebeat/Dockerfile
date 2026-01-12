FROM docker.elastic.co/beats/filebeat:8.12.2

USER root
COPY filebeat.yml /usr/share/filebeat/filebeat.yml
RUN chown root:root /usr/share/filebeat/filebeat.yml && chmod 0644 /usr/share/filebeat/filebeat.yml

USER root
