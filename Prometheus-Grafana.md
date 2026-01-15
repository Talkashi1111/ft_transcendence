https://prometheus.io/docs/introduction/overview/

# Subject requirements

**Minor module**: Monitoring system.  
The goal of this minor module is to set up a comprehensive monitoring system using Prometheus and Grafana . Key features and goals include:

- Deploy Prometheus as the monitoring and alerting toolkit to collect metrics and monitor the health and performance of various system components.
- Configure data exporters and integrations to capture metrics from different services, databases, and infrastructure components.
- Create custom dashboards and visualizations using Grafana to provide real-time insights into system metrics and performance.
- Set up alerting rules in Prometheus to proactively detect and respond to critical issues and anomalies.
- Ensure proper data retention and storage strategies for historical metrics data.
- Implement secure authentication and access control mechanisms for Grafana to protect sensitive monitoring data.


# Initial Set Up

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

## 3. Create Prometheus Configuration

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
### `job-name`
A job represents one monitoring task: scrape these targets using this configuration.
All targets listed under the same job_name are assumed to expose the same type of metrics and are scraped in the same way.
job_name becomes a label automatically added to every metric scraped from those targets.

#### How Prometheus uses `job-name`

##### 1. Metric labeling

Every scraped metric will include:

```text
job="ft_transcendence_backend"
```

Example metric:

```text
http_requests_total{job="ft_transcendence_backend", instance="app:3000"}
```

This is critical for:
* Filtering
* Aggregation
* Alerting

##### 2. Querying (PromQL)

You can query metrics for this job specifically:

```promql
rate(http_requests_total{job="ft_transcendence_backend"}[1m])
```

##### 3. Alerting

Alert rules typically reference `job`:

```yaml
expr: up{job="ft_transcendence_backend"} == 0
```

##### 4. UI organization

In the Prometheus web UI:

* Targets are grouped by `job`
* Failures are reported per job

#### Naming conventions (best practices)

* Use **descriptive, stable names**
* Usually represent a **service or component**
* Avoid environment-specific values unless intentional

### In short

`job_name` is:

* A **group name for scrape targets**
* A **mandatory label added to all metrics**
* A **key dimension for querying, alerting, and debugging**

If you want, I can also explain how `job` differs from `instance`, which is a very common point of confusion in Prometheus setups.


### `targets: ['app:3000']`
Because we will run Prometheus in Docker, it can see your other containers by their service name. It will look for the app container (defined in your docker-compose) on port 3000.

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

#### - The source: http://localhost:3000/metrics

What it is: The Exporter (Raw Data). Service: Your Node.js Backend (app).  
This is the endpoint we created in backend/src/app.ts by registering the fastify-metrics plugin. It translates your server's internal state (memory usage, request counts) into a text format that Prometheus can read.  Humans rarely read this. This page exists solely so Prometheus can visit it every 5 seconds to "scrape" (copy) the data.

#### - The collector: http://localhost:9090/

What it is: Prometheus (The Database). http://localhost:9090/ serves the Prometheus built-in Web UI. Service: The prometheus container defined in docker-compose.dev.yml. Role: It is the "brain" that stores history.  
How it works:
- It reads your prometheus.yml configuration file.
- It connects to app:3000/metrics every 5 seconds.
- It saves that data with a timestamp.
Why visit this? To debug. If your graphs are empty, you check here to see if the "Target" (app) is UP or DOWN. You can also write raw "PromQL" queries here to test them.

#### - The visualizer: http://localhost:3001

What it is: Grafana (The Dashboard). Service: The grafana container defined in docker-compose.dev.yml. Role: It makes the data beautiful and understandable.  
How it works:
- It does not touch your backend directly.
- It connects to Prometheus (internally at http://prometheus:9090).
- It asks Prometheus: "Give me the CPU usage for the last hour."
- It draws the line chart you see.

### Summary of the Flow:
- Backend (:3000) says: "I am using 50MB of RAM right now."
- Prometheus (:9090) asks every 5s: "How much RAM?" -> Saves "50MB at 10:00:05".
- Grafana (:3001) asks Prometheus: "Draw me a graph of RAM usage."

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

## The default dashboard and its charts
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

# Stuff

## prom-client

**prom-client** is the standard, official Node.js library used to generate Prometheus metrics.

Think of it as the **"Engine"** that powers your monitoring.

### 1. What does it do?

It provides the JavaScript classes you need to create metrics. It handles all the complex logic of:

* Counting numbers safely.
* Calculating averages (histograms).
* Formatting the data into the weird text format that Prometheus understands.

### 2. Relationship with `fastify-metrics`

You are currently using `fastify-metrics`.

* **prom-client** = The low-level library (The Engine).
* **fastify-metrics** = A high-level plugin (The Car) that wraps `prom-client` and automatically connects it to Fastify's router.

When you install `fastify-metrics`, it installs `prom-client` automatically in the background.

### 3. The 4 Main Tools (Metric Types)

`prom-client` gives you four tools to measure things. You will need these for your **Custom Metrics**:

| Tool | Name | Behavior | Example Use Case |
| --- | --- | --- | --- |
| 🔢 | **Counter** | Only goes UP. Resets on restart. | Total requests, Total errors. |
| 🌡️ | **Gauge** | Goes UP and DOWN. | Active users, Memory usage, Temperature. |
| 📊 | **Histogram** | Buckets values (e.g., "0-10ms", "10-100ms"). | Request duration, Response size. |
| 📝 | **Summary** | Similar to Histogram but calculates quantiles (95th %). | (Rarely used now, Histograms are preferred). |

### Example Code

If you want to create a custom metric (like "Connected Users"), you import the class directly from `prom-client`:

```typescript
import { Gauge } from 'prom-client';

const activeUsers = new Gauge({
  name: 'app_active_users_total',
  help: 'Current number of users connected via WebSocket'
});

// Logic
activeUsers.inc(); // +1
activeUsers.dec(); // -1
activeUsers.set(10); // = 10

```

## Multi-dimensional Data Model

This sounds complicated, but it just means **"Data with Labels"**.

* **1-Dimensional Data (Simple):**
Imagine a simple counter. You just have one number.
`http_requests_total = 50`
*You know you had 50 requests, but you don't know if they were GET, POST, successful, or errors.*
* **Multi-Dimensional Data (Prometheus):**
Prometheus adds "dimensions" (labels) to that single metric name using key/value pairs.
```text
http_requests_total{method="GET", status="200"} = 30
http_requests_total{method="POST", status="200"} = 15
http_requests_total{method="POST", status="500"} = 5
```
Now you have "dimensions." You can ask: "Give me all errors" (filter by `status="500"`) or "Give me all POST requests" (filter by `method="POST"`).

## Is PromQL like MySQL?

**No, they are very different.**

* **MySQL (SQL):** Used for **Relational Data** (tables, rows, user accounts, game history). You ask questions like: *"Find the user with ID 5"* or *"Count all games played by talkashi1111"*.
* **PromQL:** Used for **Math over Time**. You don't select "rows." You select "streams of numbers" and do math on them.

**Example:**

* **MySQL:** `SELECT * FROM users WHERE id = 1;` (Give me this specific record).
* **PromQL:** `rate(http_requests_total[5m])` (Calculate the average number of requests per second over the last 5 minutes).

## Time Series (French: *Séries Temporelles*)

**Translation:**
In French, "Time Series" is translated as **"Série Temporelle"** (or sometimes "Série Chronologique").

**Explanation:**
A time series is simply a list of values recorded at specific points in time. Think of it like a heart rate monitor or a stock price chart.

* **Not Time Series (your Database):**
Your User database stores the *current* state.
*User: Gentian, Level: 5.* (If you level up to 6, the 5 is gone forever).
* **Time Series (Prometheus):**
Prometheus remembers the history.
* 10:00 AM -> Level 5
* 10:05 AM -> Level 5
* 10:10 AM -> Level 6

Because it remembers the value at every "time" step, you can draw a line chart to see *when* you leveled up. That line on the chart is the "Time Series."

Here are the answers to your questions about PromQL and Prometheus storage.

## How to do a query with PromQL?

You can write and test PromQL queries in two main places:

1. **Prometheus UI** (Best for testing): Go to [http://localhost:9090/query]
2. **Grafana Explore** (Best for visualizing): Go to [http://localhost:3001/explore]

Here is the "Grammar" of a PromQL query, using your project as an example:

#### A. The Simplest Query (Select Everything)

Just type the **Metric Name**. This returns the current value for every instance found.

* **Query:** `process_cpu_user_seconds_total`
* **Result:** `1.45` (Your backend has used 1.45 seconds of CPU since it started).

#### B. Filtering with Labels `{}`

If you want to be specific (e.g., only POST requests), you add "labels" inside curly braces.

* **Query:** `http_request_duration_seconds_count{method="POST"}`
* **Result:** Returns the count only for POST requests.

#### C. Looking at the Past `[]` (Range Vector)

If you want to see "what happened in the last 5 minutes," you add a time range in brackets.

* **Query:** `http_request_duration_seconds_count[5m]`
* **Result:** Returns a *list* of values recorded over the last 5 minutes.
* *Note: You cannot graph this directly; you usually use it with a function (see D).*

#### D. Using Functions (The "Math")

This is where PromQL becomes powerful. The most common function is `rate()`, which calculates "per second."

* **Query:** `rate(http_request_duration_seconds_count[1m])`
* **Meaning:** "Look at the count over the last 1 minute and calculate how many requests represent per second."
* **Result:** `0.5` (Means you are getting 1 request every 2 seconds).

### Example
Query: `http_request_duration_seconds_count`

First result: `http_request_duration_seconds_count{instance="app:3000", job="ft_transcendence_backend", method="GET", route="/metrics", status_code="200"} 18`

#### 1. The Metric Name: `http_request_duration_seconds_count`

* **What it measures:** The **total count** of HTTP requests completed.
* **Context:** Even though the name says "duration," the suffix `_count` specifically means "how many times did this happen?" (It is part of a Histogram metric that tracks both how long things take and how often they happen).

#### 2. The Labels (The "Who, What, Where")

* **`instance="app:3000"`**: **Who** handled it? Your backend container (`app`) on port 3000.
* **`job="ft_transcendence_backend"`**: **Who** asked for it? This is the job name we defined in `prometheus.yml`.
* **`method="GET"`**: **How** was it asked? It was a standard read request (GET).
* **`route="/metrics"`**: **What** was requested? The `/metrics` endpoint.
* **`status_code="200"`**: **Result?** Success (200 OK).

#### 3. The Value: `18`

* **Meaning:** This specific event has happened **18 times** since the server started.

#### 4. The "In Plain English" Summary

> *"Your backend (`app:3000`) has successfully replied to a GET request for the `/metrics` page **18 times**."*

### 💡 Why is this number increasing?

This is **Prometheus scraping itself!**
Remember, we configured Prometheus to visit `http://app:3000/metrics` every **5 seconds**.

* Every 5 seconds, Prometheus visits that route.
* The backend counts +1 request.
* So, this number will go up by roughly 12 every minute (60s / 5s = 12), plus any times you visit it manually in your browser.

## Where is the data stored?

Prometheus stores its Time Series data locally **on the disk** (it does not use a SQL database). It uses a custom highly efficient format.

**However, in your specific Docker setup, there is a catch.**

Based on the `docker-compose.dev.yml` configuration we created, the data is currently stored **inside the container**.

* **Location:** `/prometheus` (inside the Docker container).
* **Persistence:** **Ephemeral (Temporary)**.

⚠️ **Important Warning:**
Because we did not map a "volume" for the data in your `docker-compose.dev.yml`, **if you delete the container (`docker-compose down`), all your historical data will be lost.**

#### How to fix this (Make data persistent)

If you want your metric history to survive after you restart or remove containers, you need to update your `docker-compose.dev.yml` to save the data to a Docker Volume.

**Add this to your `prometheus` service:**

```yaml
  prometheus:
    # ... existing config ...
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus  # <--- ADD THIS LINE

```

**And define the volume at the bottom of the file:**

```yaml
volumes:
  sqlite-data:
  # ... existing volumes ...
  prometheus_data:  # <--- ADD THIS LINE
```

Now, the data will be stored in a Docker Volume named `prometheus_data` on your host machine, safe from container deletions.

# Data exporters and integration

In the general context of monitoring with Prometheus, the goal is always the same: **Prometheus needs to fetch text data** (metrics) from a target.

The difference between **Integration** and **Exporters** is simply: **"Who is generating that text?"**

### Summary Comparison

| Feature | Integration (Instrumentation) | Exporter |
| --- | --- | --- |
| **Target** | Your own code (White Box) | Third-party software (Black Box) |
| **Who serves data?** | The App itself | A separate "Translator" process |
| **Complexity** | Requires coding knowledge | Requires configuration (Docker) |
| **Example** | `fastify-metrics` in your backend | `node_exporter` for Linux, `mysqld_exporter` |
<br/>

## 1. Integration (Direct Instrumentation)

**"The Native Speaker"**

This is used when **you own the source code**. You modify your application code to "speak" the Prometheus language natively.

* **How it works:** You import a library (like `fastify-metrics` for Node.js, or the official Python client) directly into your project. Inside your code, you write instructions like `request_counter.inc()`.
* **The Result:** Your application itself opens a port (e.g., `/metrics`) and serves the data.
* **Context:** Used for your custom APIs, background workers, or any software you are building yourself.

## 2. Exporters

**"The Translator"**

This is used for **software you did not write** (Third-party software). You cannot open the source code of the Linux Kernel, PostgreSQL, or NGINX and add your own variables to it.

* **How it works:** You run a small, separate program called an **Exporter** right next to the target.
1. The Exporter asks the target (e.g., Database): *"How many connections do you have?"* (using the database's own internal API).
2. The Database replies in its own format.
3. The Exporter **translates** that answer into Prometheus text format.
4. Prometheus scrapes the Exporter, not the Database directly.

* **Context:** Used for Operating Systems (Node Exporter), Databases (Postgres Exporter), Hardware, or Cloud APIs.

### Example Set up

Add to `docker-compose.dev.yml`:
```YAML
# ... other services ...

  node-exporter:
    image: prom/node-exporter:latest
    container_name: node-exporter
    restart: unless-stopped
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro
    command:
      - '--path.procfs=/host/proc'
      - '--path.sysfs=/host/sys'
      - '--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)'
    ports:
      - "9100:9100"
    networks:
      - transcendence
```

Update `prometheus.yml`:
```YAML
scrape_configs:
  - job_name: 'ft_transcendence_backend'
    static_configs:
      - targets: ['app:3000']

  # Add this new job
  - job_name: 'node_exporter'
    static_configs:
      - targets: ['node-exporter:9100']
```
<br>

**Node Exporter monitors outside the container.**
Normally, a Docker container is isolated—it lives in its own little bubble and doesn't know about the host machine (your computer). It typically only sees its own "virtual" CPU and memory.

However, node-exporter is designed to monitor the Host Machine (the actual server or laptop running Docker). To do this from inside a container, we have to "poke holes" in the container's isolation using volumes.

These volume mappings are the key. We are mounting the host's critical system directories *into* the container so `node-exporter` can read them.

**`/proc:/host/proc:ro`**:
* **Host (`/proc`)**: This is a special virtual folder in Linux. It contains direct information from the **Kernel** (CPU info, memory stats, running processes).
* **Container (`/host/proc`)**: We map it to `/host/proc` inside the container.
* **`:ro`**: Read-Only. We don't want the container to *change* our system settings, only *read* them.

**`/sys:/host/sys:ro`**:
* Similar to `/proc`, but for hardware info (disk stats, network devices, power management).

**`/:/rootfs:ro`**:
* This maps your **entire hard drive** (root `/`) to `/rootfs` inside the container. This allows the exporter to measure disk usage (e.g., "How much space is left on the main disk?").

By default, `node-exporter` looks at `/proc` and `/sys` (which would be the *container's* fake system folders). We need to tell it: *"Don't look at your own folders. Look at the host folders we just mounted."*
* **`--path.procfs=/host/proc`**: "Hey exporter, when you want CPU stats, look in `/host/proc` (which is actually the real computer's `/proc`)."
* **`--path.sysfs=/host/sys`**: "Same for hardware stats."
* **`--collector.filesystem.mount-points-exclude...`**:
* This is a regex filter.
* It tells the exporter: *"Ignore these specific weird folders."*
* Since we mounted the whole hard drive, we don't want it to count the virtual folders (like `/sys` or `/proc`) as "Disk Space" because they aren't real disks. This prevents duplicate or garbage data in your graphs.

### Summary

1. **Container:** Runs isolated.
2. **Volumes:** We map the "Host's Brain" (`/proc`, `/sys`) into the container.
3. **Command:** We tell the software to look at those mapped folders instead of its own.

**Result:** A containerized program that can tell you exactly how hot your physical CPU is running!

## cAdvisor
**cAdvisor** (short for **C**ontainer **Advisor**) is an open-source tool created by **Google**.

It is an **Exporter** specifically designed to monitor **Docker Containers**.

### The "Missing Piece" of Your Puzzle

To understand why you might need it, let's look at the layers of monitoring you currently have:

1. **Node Exporter:** Monitors the **Host Machine** (Hardware).
* *Question it answers:* "Is my laptop's CPU at 100%?"
* *Blind spot:* It doesn't know *which* program is using the CPU. It just sees the total.


2. **Fastify Metrics (Integration):** Monitors your **Application Logic**.
* *Question it answers:* "How many HTTP requests am I handling?"
* *Blind spot:* It doesn't know how much RAM the container is actually using compared to its limit.


3. **cAdvisor:** Monitors the **Containers**.
* *Question it answers:* "Is the `grafana` container using more RAM than the `backend` container?"
* *Role:* It talks to the Docker Daemon to get stats for **every running container** individually.



### What Metrics Does It Give?

If you add cAdvisor, you can visualize:

* **CPU Usage per Container:** "The backend is using 50% CPU, but the Database is idle."
* **Memory Usage:** "The Grafana container is leaking memory."
* **Network I/O:** "Which container is downloading so much data?"
* **Dropped Packets:** Useful for debugging network issues between containers.

### How to Add It (Optional but Recommended)

If you want to validate the "Infrastructure Monitoring" requirement thoroughly, adding cAdvisor is a great move.

**Add this to your `docker-compose.dev.yml`:**

```yaml
  cadvisor:
    image: gcr.io/cadvisor/cadvisor:latest
    container_name: cadvisor
    ports:
      - "8081:8080" # 8080 may taken by caddy in the prod
    volumes:
      - /:/rootfs:ro
      - /var/run:/var/run:ro
      - /sys:/sys:ro
      - /var/lib/docker/:/var/lib/docker:ro
      - /dev/disk/:/dev/disk:ro
    networks:
      - transcendence
```

**And add the job to `prometheus.yml`:**

```yaml
  - job_name: 'cadvisor'
    static_configs:
      - targets: ['cadvisor:8080'] # Even though we map to 8081 externally, use 8080 internally (they are in the same Docker network)
```

**Summary:**  

Prometheus collects from:
- **Node Exporter** = Monitor the **Computer**.
- **cAdvisor** = Monitor the **Docker Containers**.
- **Your App Metrics** = Monitor the **Code**.  

Grafana is the Unified Dashboard that centralizes all these different data streams.

<br/>

# Visualize your SQLite Data
Since you are using SQLite (a file-based database) and Prisma, the best way to "monitor" it in Grafana is to install the **SQLite Data Source Plugin** and not an exporter.  

Exporter: Target (OS) -> Exporter -> Prometheus -> Grafana  
Plugin: SQLite File -> Grafana. (Prometheus is not involved).  

When you use this plugin, Grafana reads your database.db file directly to count rows.
This will allow you to run SQL queries directly in Grafana (e.g., "How many users are registered?", "How many friend requests are pending?") and visualize the answers.

Here is how to set it up step-by-step:

### Step 1: Update `docker-compose.dev.yml`

You need to do two things:

1. Tell Grafana to install the SQLite plugin on startup.
2. Give Grafana access to your database file (by sharing the volume).

**Open `docker-compose.dev.yml` and modify the `grafana` service:**

```yaml
  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_INSTALL_PLUGINS=frser-sqlite-datasource # <--- ADD THIS
    volumes:
      - sqlite-data:/var/lib/grafana/db-mount # <--- ADD THIS (Mounts your DB volume)
    networks:
      - transcendence
    depends_on:
      - prometheus
```

*(Make sure `sqlite-data` matches the volume name used by your `app` service).*

### Step 2: Apply Changes

Run this command from your **host machine** to rebuild the Grafana container with the new plugin:

```bash
docker compose -f docker-compose.dev.yml up -d --build grafana
```

*(Wait about 30 seconds for the plugin to install and Grafana to start).*

### Step 3: Configure the Data Source

1. Open Grafana: [http://localhost:3001](https://www.google.com/search?q=http://localhost:3001)
2. Go to **Connections** > **Data Sources** > **Add data source**.
3. Search for **SQLite** and select it.
4. **Configure the Path**:
* **Path**: `/var/lib/grafana/db-mount/dev.db`
* *(Note: The filename `dev.db` depends on what you named it in your `.env` file. You might need to check your backend logs or file structure to confirm the exact name inside that volume. It is often `dev.db` or `database.db`)*.
5. Click **Save & test**.
* *Success:* "Data source is working".
* *Error:* "file is encrypted or is not a database": Check the filename.
* *Error:* "permission denied": This is a common Docker issue. Try running `chmod 644` on the db file or running the container as root (temporarily) to test.

### Step 4: Create Your Own Dashboard

Now you can build a custom "Game Stats" dashboard:

1. **Create New Dashboard** > **Add Visualization**.
2. Select **SQLite** as the data source.
3. Write a SQL Query.
* **Example (Count Users):**
```sql
SELECT count(*) as value, 'Users' as metric FROM User
```
* **Example (Pending Friend Requests):**
```sql
SELECT count(*) as value, 'Pending Requests' as metric FROM Friendship WHERE status = 'PENDING'
```

4. Choose a visualization (Stat, Bar Chart, etc.) and Apply.

This allows you to create a **Business Dashboard** that shows the actual activity in your `ft_transcendence` project!

# Provisioning
When you rebuild a container, the data that was inside is lost and thus your setup; the data source connections, your beautiful custom dashboards and you (or your colleagues that want to see your magnificient dashboards) will have to reconfigure all of it. But you can automate this! Grafana has a feature called Provisioning that lets you define data sources and dashboards in YAML files. Since these are files, you can push them to Git.  
When your colleagues start the project, Grafana will read these files and automatically set everything up for them.

Here is how to do it (it takes 3 steps):

### Step 1: Export Your Dashboard

1. Go to your Dashboard in Grafana.
2. Click the **Share** button (top right, usually looks like a "Share" icon).
3. Go to the **Export** tab.
4. Toggle **"Export for sharing externally"** (this removes hardcoded IDs).
5. Click **Save to file**.
6. **Move this JSON file** into your project folder. Let's create a structure like this:
```
transcendence/
└── grafana/
    └── dashboards/
        └── my-dashboard.json  <-- Put your JSON file here

```



### Step 2: Create Configuration Files

Create a `provisioning` folder inside your `grafana` folder:
`transcendence/grafana/provisioning/`

**A. Create `datasources.yaml**`
File: `grafana/provisioning/datasources/datasources.yaml`

```yaml
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: false # Prevents accidental changes in UI

```

**B. Create `dashboards.yaml**`
File: `grafana/provisioning/dashboards/dashboards.yaml`

```yaml
apiVersion: 1

providers:
  - name: 'Default'
    orgId: 1
    folder: ''
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    options:
      path: /etc/grafana/dashboards # Where we will mount the JSON files

```

### Step 3: Update `docker-compose.dev.yml`

We need to mount these new configuration folders into the Grafana container.

Update your `grafana` service volumes:

```yaml
  grafana:
    # ... existing config ...
    volumes:
      - grafana-storage:/var/lib/grafana
      - sqlite-data:/var/lib/grafana/db-mount
      - ./grafana/provisioning:/etc/grafana/provisioning
      - ./grafana/dashboards:/etc/grafana/dashboards

```

### Summary

When you use `volumes: - ./local/path:/container/path` in `docker-compose.dev.yml`, Docker creates a bind mount that overlays a host directory onto a directory inside the container. This overlay hides any existing files in the container at that path and makes the host’s files immediately visible inside the container, even without using a `COPY` instruction in the Dockerfile.

When `docker compose up` is executed, the container starts and Docker activates the bind mounts. Grafana then initializes by reading its provisioning directory from the mounted path. It detects the data source configuration and automatically connects to Prometheus, then reads the dashboard provisioning instructions to locate dashboard JSON files. Grafana loads these dashboards from the mounted directory, imports them into its internal database, and starts fully configured and ready to use.  

By committing the Grafana provisioning files, a colleague can pull the repository, run docker compose up, and have Grafana automatically configure data sources and import dashboards, resulting in a ready-to-use setup with no manual steps. 🚀


# Custom Metric and Dashboard

If you want to monitor some data of your application, for example the number of users currently connected, you'll have to create a custom metric in your code.

### Example 1: Creating the metric `transcendence_connected_users_total`
In already implemented code (great work from my colleague there!), I have map tracking connected sockets.

#### A. Add the import at the top of the file:
```ts
import { Gauge } from 'prom-client';
```
Note: 'prom-client' may be underlined in red. This happens because 'prom-client' is currently a "hidden" dependency (installed automatically by fastify-metrics, but not listed in your package.json for you to use directly). To fix this, you need to install it explicitly. Run this command in your backend; `pnpm add prom-client`.

#### B. Define the Gauge
```ts
// Track connected sockets by user ID
const connectedSockets = new Map<string, AuthenticatedSocket>();

// --- ADD THIS BLOCK ---
// Define Custom Metric
new Gauge({
  name: 'transcendence_connected_users_total', // The metric name in Grafana
  help: 'Number of users currently connected via WebSocket',
  collect() {
    // This function runs every time Prometheus scrapes.
    // It automatically syncs the metric with the real map size.
    this.set(connectedSockets.size);
  },
});
```
That's it! No need to manually inc() or dec() inside the functions. The collect() magic handles it.

### Example 2: Creating the metric `transcendence_active_remote_games_total`

For matches, we will distinguish between "1v1" and "Tournament" games using a **Label** in `backend/src/modules/game/match-manager.ts**`

**A. Add the import:**

```typescript
import { Gauge } from 'prom-client';
```

**B. Define the Gauge (At the top, before the class):**

```typescript
// ... imports

// --- ADD THIS ---
const activeGamesGauge = new Gauge({
  name: 'transcendence_active_games_total',
  help: 'Number of active matches currently running',
  labelNames: ['mode'], // We will label them as '1v1' or 'tournament'
});
// ----------------

```

**C. Update `createMatch` (Increment):**
Locate the `createMatch` method. Add the increment line right before `return match;`.

```typescript
  createMatch(
    playerId: string,
    username: string,
    socket: WebSocket,
    mode: MatchMode = '1v1'
  ): ActiveMatch {
    // ... existing code ...
    
    this.matches.set(matchId, match);
    this.playerMatches.set(playerId, matchId);

    console.log(`[MatchManager] Match ${matchId} created by ${username}`);

    // --- ADD THIS ---
    activeGamesGauge.inc({ mode: mode }); // +1 for this specific mode
    // ----------------

    this.notifyMatchListUpdate();
    return match;
  }
```

**D. Update `cleanupMatch` (Decrement):**
Locate the `cleanupMatch` method. Add the decrement line right before `this.matches.delete(matchId)`.

```typescript
  private cleanupMatch(matchId: string): void {
    const match = this.matches.get(matchId);
    if (!match) return;

    // ... stop engine, clear timeout ...

    // Remove player mappings
    this.playerMatches.delete(match.player1.id);
    if (match.player2) {
      this.playerMatches.delete(match.player2.id);
    }

    // --- ADD THIS ---
    activeGamesGauge.dec({ mode: match.mode }); // -1
    // ----------------

    // Remove match
    this.matches.delete(matchId);

    console.log(`[MatchManager] Match ${matchId} cleaned up`);
  }
```

#### 4. Verify It Works

1. **Restart your backend container**:
```bash
docker compose -f docker-compose.dev.yml up -d --build app
```

2. **Open two browser tabs** and log in to your app (this connects the WebSockets).
3. **Start a game** in one tab.
4. **Check the raw metrics**:
Go to `http://localhost:3000/metrics`.
Search (Ctrl+F) for `transcendence`. You should see:
```text
# HELP transcendence_connected_users_total Number of users currently connected...
# TYPE transcendence_connected_users_total gauge
transcendence_connected_users_total 2

# HELP transcendence_active_games_total Number of active matches...
# TYPE transcendence_active_games_total gauge
transcendence_active_games_total{mode="1v1"} 1
```

## Labels

Labels are the single most powerful feature in Prometheus, but the syntax can be a little confusing at first.

Think of **Labels** as "Tags" or "Categories" that allow you to split one metric into multiple detailed versions.

### 1. `labelNames: ['mode']` (The Setup)

When you define the Gauge, you are telling Prometheus:
*"I am going to track 'Active Matches', but I don't want just one big total number. I want to be able to split this number based on the **Game Mode**."*

If you didn't do this, you would only know that "5 games are running," but you wouldn't know if they were 1v1s or Tournaments.

### 2. `.inc({ mode: mode })` (The Usage)

When you actually increment the counter, you have to be specific about **which category** you are adding to.

* **The Syntax:** `{ mode: mode }` is a standard JavaScript object.
* The **first word** (`mode`) is the **Key**: It must match the string you defined in `labelNames`.
* The **second word** (`mode`) is your **Variable**: It holds the actual value (like `'1v1'` or `'tournament'`).

**What actually happens behind the scenes:**

1. If `mode` is `'1v1'`, the library finds the specific counter for `1v1` and adds 1.
2. If `mode` is `'tournament'`, it finds the *different* counter for `tournament` and adds 1.


### The Result in Prometheus

Because you used labels, Prometheus will essentially create **two separate graphs** for you automatically:

**If you have 3 '1v1' games and 1 'tournament' game:**

```text
# This is what /metrics will show:

transcendence_active_remote_matches_total{mode="1v1"} 3
transcendence_active_remote_matches_total{mode="tournament"} 1
```

### Why is this useful?

Now, in Grafana, you can do two different things with the exact same metric:

1. **See the Total:**
`sum(transcendence_active_remote_matches_total)` -> Result: **4**
2. **See Specifics:**
`transcendence_active_remote_matches_total{mode="tournament"}` -> Result: **1**

Without `labelNames`, you would have been forced to create two completely separate variables like `activeMatches1v1Gauge` and `activeMatchesTournamentGauge`, which is messy!

## A common mistake: "Cardinality Explosion"
Metrics from frontend: Page Views tracking. Every time a user navigates to a new URL (e.g., /game, /profile, /chat), you send a metric.
If 100 users view 1 page each, or 1 user views 100 pages, the graph looks exactly the same (Total = 100).

**Is it possible to label views with registered users?**
**Technically Yes, but YOU SHOULD NOT DO IT.**

This is the most common mistake in Prometheus, called the **"Cardinality Explosion"**.

**Why it is dangerous:**
Prometheus creates a **separate time-series database entry** for every unique label combination.

* If you label by `page`: You have ~10 pages. Prometheus tracks 10 metrics. (Excellent ✅)
* If you label by `user_id`: If you have 1,000 users, Prometheus tries to manage **1,000 separate metrics** for just this one counter. If you have 10,000 users, your Prometheus container will likely **run out of RAM and crash**.

**The Rule of Thumb:**

* **Prometheus (Metrics):** Use for data with **few** possibilities (Page names, Status codes 200/404, Game Modes).
* **Logs (ELK/Console):** Use for data with **many** possibilities (User IDs, Match IDs, Chat messages).

**What to do instead?**
If you want to track "Who visited what?", use a standard console.log in your backend. If ELK is setup, Kibana is the perfect tool to visualize "User X visited Page Y".

# Alert Configuration
