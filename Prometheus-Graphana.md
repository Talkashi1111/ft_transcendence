# Subject requirements

**Minor module**: Monitoring system.
The goal of this minor module is to set up a comprehensive monitoring system using Prometheus and Grafana . Key features and goals include:

- Deploy Prometheus as the monitoring and alerting toolkit to collect metrics and monitor the health and performance of various system components.
- Configure data exporters and integrations to capture metrics from different services, databases, and infrastructure components.
- Create custom dashboards and visualizations using Grafana to provide real-time insights into system metrics and performance.
- Set up alerting rules in Prometheus to proactively detect and respond to critical issues and anomalies.
- Ensure proper data retention and storage strategies for historical metrics data.
- Implement secure authentication and access control mechanisms for Grafana to protect sensitive monitoring data.

# Prometheus and grafana
In Greek mythology, Prometheus is a Titan responsible for creating or aiding humanity in its earliest days. He defied the Olympian gods by taking fire from them and giving it to humanity in the form of technology, knowledge and, more generally, civilization. 


# Set up

Is it considered you have a project with a backend and and docker-compose.yml

## 1. Install the Metrics Library

You need a library to expose Fastify metrics in a format Prometheus can understand. The standard plugin is fastify-metrics.
In the backend directory;

```bash
pnpm add fastify-metrics
```

This command will download the fastify-metrics package from the npm registry, add it to your backend/package.json file under dependencies, update your pnpm-lock.yaml to lock the specific version installed, make the library available for import in your code (e.g., in app.ts).

`fastify-metrics` is a bridge between your Fastify server and Prometheus. It wraps prom-client, the standard Node.js library for Prometheus. It automatically tracks standard metrics like "how long requests take" (latency), "how many requests are successful vs. errors" (status codes), and "how much memory is used." It exposes an Endpoint: It creates a route (usually /metrics) that Prometheus can "scrape" (read) periodically to get this data.

## 2. Configure the backend

### 2.1 Add the import

```ts
import fastifyMetrics from 'fastify-metrics';
```

### 2.2 Register the plugin for your fastify server

```ts
await server.register(fastifyMetrics, {
  endpoint: '/metrics',
  defaultMetrics: { enabled: true },
});
```

`endpoint: '/metrics'`: Creates a new URL http://localhost:3000/metrics. If you visit this later, you'll see raw text data describing your server's health.

`defaultMetrics: { enabled: true }`: Tells the library to also track standard Node.js stuff like memory usage and CPU load, not just HTTP requests.

### 3. Create Prometheus Configuration

We need to tell Prometheus where to find those metrics we just exposed, by creating a configuration file that the Prometheus container will read.  
`prometheus.yml` (in the same folder as docker.compose):

```YAML
global:
  scrape_interval: 5s # Check for new data every 5 seconds

scrape_configs:
  - job_name: 'ft_transcendence_backend'
    static_configs:
      - targets: ['app:3000'] # Connects to the 'app' service on port 3000
```

`targets: ['app:3000']`: This is crucial. Because we will run Prometheus in Docker, it can see your other containers by their service name. It will look for the app container (defined in your docker-compose) on port 3000.

## 4. Update your `docker-compose.yml` and restart your infrastructure

```YAML
...

prometheus:
    image: prom/prometheus:latest
    container_name: prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"
    networks:
      - transcendence

  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    networks:
      - transcendence
    depends_on:
      - prometheus

...
```

- Prometheus: Mounts the config file you just created (./prometheus.yml) so it knows what to scrape.
- Grafana: We map it to port 3001 (3001:3000) if your backend is already using port 3000.
- Networks: Both are attached to transcendence so they can talk to your app container.

### (Re)start the services

on the host;

```Bash
docker compose -f docker-compose.dev.yml up -d --build
```

(Note: Use `docker-compose` instead of `docker compose` if you have old Docker)

You'll need to restart your server; `pnpm dev` inside your backend.

You may encounter the error: TypeScript type mismatch. It happens because fastify-metrics (v12) and fastify (v5) have slightly different expectations about how the plugin is defined in strict TypeScript environments, or simply because of how the module is being imported in your setup.  
Essentially, TypeScript is complaining: "I expect a specific Plugin function signature, but you gave me an imported Module object."  
Modify the registration of the plugin:

```ts
// Register Metrics Plugin
// eslint-disable-next-line @typescript-eslint/no-explicit-any
await server.register(fastifyMetrics as any, {
  endpoint: '/metrics',
  defaultMetrics: { enabled: true },
});
```

## 5. Verify the endpoints

With your app running, open these three URLs in your browser:

#### - http://localhost:3000/metrics

Look for: A plain text page. You should see lines starting with # HELP, # TYPE, etc. (e.g., process_cpu_user_seconds_total).

#### - http://localhost:9090/targets

Look for: A table listing ft_transcendence_backend.
Check: The State column must say UP (in green).

#### - http://localhost:3001

Look for: The Grafana login screen.

## 6. Connect Grafana to Prometheus 
- **Open Grafana** on [http://localhost:3001].
- Click the **Menu** (hamburger icon) in the top-left.
- Expand **Connections**.
- Click **Data source**. Then **Add data source**.
- Select **Prometheus** from the list.
- Crucial Step: In the Prometheus server URL field, enter exactly this: `http://prometheus:9090`
(Note: We use prometheus as the hostname because inside the Docker network, Grafana sees the container by its service name, not localhost).
- Save & test. You should see a green checkmark saying "Successfully queried the Prometheus API".


## 7. Import a Pre-made Dashboard

Looking at raw text is not very useful. Instead of building charts from scratch, we can import a community dashboard that works perfectly with the default metrics we enabled.

- Click the **Menu** (hamburger icon) in the top-left.
- Expand **Dashboards**.
- Click **Import**.
- In the "Import via grafana.com" box, enter the ID: **11159** _(This is a popular "Node.js Application Dashboard" that works with your setup)._
- Click **Load**.
- Change the **Name** if you want (e.g., "Transcendence Backend").
- At the bottom, under **Prometheus** (data source), select the data source you created (it might be named "Prometheus" or similar).
- Click **Import**.

Et voilà! You should see charts now visualizing metrics of your app.  
Note: We configured Prometheus to scrape data  from the app every 5 seconds (scrape_interval: 5s). If you set Grafana (that scraps from prometheus) faster than that (like 1s), it would just show the same data point 5 times in a row.

## The dahsboard and its default charts
This dashboard visualizes the internal health of your **Node.js** backend (`app` service).

### 1. Process CPU Usage
This shows how much of a CPU core your backend is using.  
Node.js is single-threaded. If this hits **100%**, your backend is completely frozen processing a calculation and cannot answer new requests. In a healthy web server, this should stay very low (< 5-10%) unless you are doing heavy data processing (like resizing an avatar).

### 2. Event Loop Lag

* **What it is:** The delay between when Node.js *wants* to execute a function and when it *actually* can.
* **Why it matters:** Node.js handles thousands of requests by quickly switching tasks (the "Event Loop"). If one task takes too long (e.g., a massive `while` loop), the loop "lags" and delays everyone else.
* **Healthy values:** You want this near **0ms**. If it spikes (e.g., > 100ms), your server feels "sluggish" to users.

### 3. Process Restart Time

* **What it is:** This usually displays the timestamp of when your backend last started.
* **Use case:** It helps you spot **crashes**. If you see this graph jump to the current time unexpectedly, it means your backend crashed and restarted (or Nodemon restarted it because you saved a file).

### 4. Process Memory Usage (RSS - Resident Set Size)

* **What it is:** The **total** physical RAM your backend is taking up from the computer (OS perspective).
* **Includes:** The Code itself + V8 Engine + Variables (Heap) + External libraries (C++ bindings).

### 5. Active Handles / Requests

**What it is:**
* **Requests:** Number of HTTP clients currently waiting for a response.
* **Handles:** "Open things" that the OS is managing for Node.js (open sockets, open files, timers).


**Why do you have 4 when no one is connected?**
Even "idle", a server needs handles to stay alive. The 4 handles are likely:
1. **Port 3000:** The server "listening" for new connections.
2. **Database Connection:** Prisma keeping a connection open to SQLite/File.
3. **Metrics Endpoint:** The `fastify-metrics` plugin internally maintaining state.
4. **Prometheus Scraper:** Prometheus connects every 5 seconds; sometimes the socket stays "active" (Keep-Alive) briefly between scrapes.



### 6. Heap Total / Used / Available (Detail)

These 3 charts zoom in on the **JavaScript memory** (managed by the V8 engine), which is part of the "Process Memory" above.

* **Heap Total:** How much memory V8 has *reserved* from the OS.
* **Heap Used:** How much memory your actual variables/objects are *currently occupying*.
* **Heap Available:** How much space is left before V8 needs to ask the OS for more (or crash if it hits the limit).
* **The "Sawtooth" Pattern:** You will often see the "Used" line go up slowly and then drop sharply. This is **Garbage Collection (GC)** working correctly—cleaning up unused variables. If it goes up and *never* drops, you have a **Memory Leak**.

