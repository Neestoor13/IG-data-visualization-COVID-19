import * as THREE from "three";
//import { TrackballControls } from "three/examples/jsm/controls/TrackballControls";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

let scene, renderer, camera;
let camcontrols;
let mapsx, mapsy;

let estrella;
let Planetas = [];

let datosCovid = [],
  datosGeo = [];

let mergedData = [];

let puntos = [];

let uniqueDates = [];
let currentDateIndex = 0;

let fecha2show;

// Parámetros para animateByDate()
let lastUpdateTime = 0;
const updateInterval = 500; // ms entre fechas

let raycaster, mouse;

// Variable para pausar
let isPaused = false;

// Cambio de visualización 2D a 3D
let act3D = false;

// Tipo de métrica visualizada
let metric = "new_cases";
let metricButtons;

init();
animate();

function init() {
  //Muestra fecha actual como título
  fecha2show = document.createElement("div");
  fecha2show.style.position = "absolute";
  fecha2show.style.top = "30px";
  fecha2show.style.width = "100%";
  fecha2show.style.textAlign = "center";
  fecha2show.style.color = "#fff";
  fecha2show.style.fontWeight = "bold";
  fecha2show.style.backgroundColor = "transparent";
  fecha2show.style.zIndex = "1";
  fecha2show.style.fontFamily = "Monospace";
  fecha2show.innerHTML = "";
  document.body.appendChild(fecha2show);

  // Panel de información de países
  const panel = document.createElement("div");
  panel.id = "rankingPanel";
  document.body.appendChild(panel);

  // Ocultamos el panel inicialmente
  panel.classList.add("hidden");

  // Creamos un botón para mostrar/ocultar el panel
  const rankingButton = document.createElement("button");
  rankingButton.id = "rankingButton";
  rankingButton.innerText = "🏅";
  document.body.appendChild(rankingButton);

  // Cuando hacemos click alternamos su visibilidad
  rankingButton.addEventListener("click", () => {
    panel.classList.toggle("hidden");
  });

  // Creamos un botón para pausar/reanudar la secuencia
  const pauseButton = document.createElement("button");
  pauseButton.id = "pauseButton";
  pauseButton.innerText = "⏸️ Pausar";
  document.body.appendChild(pauseButton);

  pauseButton.addEventListener("click", () => {
    isPaused = !isPaused;
    pauseButton.innerText = isPaused ? "▶️ Reanudar" : "⏸️ Pausar";
  });

  // Creamos un botón para reiniciar animación
  const resetButton = document.createElement("button");
  resetButton.id = "resetButton";
  resetButton.innerText = "🔄";
  document.body.appendChild(resetButton);

  resetButton.addEventListener("click", () => {
    currentDateIndex = 0;
    isPaused = true;
    document.getElementById("pauseButton").innerText = "▶️ Reanudar";
    updateMarkers(uniqueDates[currentDateIndex]);
    updatePanel(uniqueDates[currentDateIndex]);
    actualizarFecha(uniqueDates[currentDateIndex]);
  });

  // Creamos un botón para avanzar a la siguiente fecha
  const stepButton = document.createElement("button");
  stepButton.id = "stepButton";
  stepButton.innerText = "⏭️";
  document.body.appendChild(stepButton);

  stepButton.addEventListener("click", () => {
    if (!isPaused) return; // Limitamos a que solo funcione cuando la representación está pausada
    currentDateIndex = (currentDateIndex + 1) % uniqueDates.length;
    const date = uniqueDates[currentDateIndex];
    updateMarkers(date);
    updatePanel(date);
    actualizarFecha(date);
  });

  // Creamos un contenedor que contenga las distintas métricas que queremos visualizar
  const metricContainer = document.createElement("div");
  metricContainer.id = "metricContainer";
  document.body.appendChild(metricContainer);

  // Botones y valores de las métricas a visualizar
  metricButtons = [
    { id: "btnCumCases", label: "• Casos acumulados", value: "cum_cases" },
    { id: "btnCumDeaths", label: "• Muertes acumuladas", value: "cum_deaths" },
    { id: "btnNewCases", label: "• Casos nuevos", value: "new_cases" },
    { id: "btnNewDeaths", label: "• Muertes nuevas", value: "new_deaths" },
  ];

  metricButtons.forEach(({ id, label, value }) => {
    const btn = document.createElement("button");
    btn.id = id;
    btn.innerText = label;
    btn.classList.add("metricButton"); // Clase CSS
    btn.addEventListener("click", () => {
      metric = value;
      highlightActiveMetric(value);
      updateMarkers(uniqueDates[currentDateIndex]);
      updatePanel(uniqueDates[currentDateIndex]);
    });
    metricContainer.appendChild(btn);
  });

  // Inicializamos el primer botón activo
  highlightActiveMetric(metric);

  // Creamos un botón para cambiar entre vista 2D y 3D
  const toggleViewButton = document.createElement("button");
  toggleViewButton.id = "toggleViewButton";
  toggleViewButton.innerText = "• Vista 3D";
  document.body.appendChild(toggleViewButton);

  toggleViewButton.addEventListener("click", () => {
    act3D = !act3D;
    toggleViewButton.innerText = act3D ? "• Vista 2D" : "• Vista 3D";

    updateViewMode();
  });

  // Creamos un listener que detecte los clic del ratón (asociamos con la función onMouseClick)
  window.addEventListener("click", onMouseClick);

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.z = 5;

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();

  const ambientLight = new THREE.AmbientLight();
  scene.add(ambientLight);

  camcontrols = new OrbitControls(camera, renderer.domElement);

  // Texturas para visualización mapa y 3D
  const tx1 = new THREE.TextureLoader().load("textures/earthmap1k.jpg");
  //const tx1 = new THREE.TextureLoader().load("textures/2k_earth_daymap.jpg"); // Descomentar si quiere probarse la otra textura
  const starsTx = new THREE.TextureLoader().load("textures/2k_stars.jpg");
  scene.background = starsTx;

  mapsx = 21.6 / 2.5;
  mapsy = 10.8 / 2.5;

  Plano(0, 0, 0, mapsx, mapsy, tx1);

  // Creamos la Tierra en 3D
  Planeta(
    2, // radio
    0, // dist
    0, // vel
    0xffffff, // color por defecto
    1,
    1, // f1, f2
    tx1, // textura difusa
    undefined, // bump map
    undefined, // spec map
    undefined, // alpha
    false
  );
  Planetas[0].visible = false; // Inicializamos la visualización con el mapa 2D
  Planetas[0].rotation.y = Math.PI; // Giramos 180° porque la longitud está invertida

  // Cargamos los distintos datasets con los que trabajaremos

  //Carga de coordenadas geográficas
  fetch("src/world_country_and_usa_states_latitude_and_longitude_values.csv")
    .then((response) => {
      if (!response.ok) {
        throw new Error("Error: " + response.statusText);
      }
      return response.text();
    })
    .then((content) => {
      procesarCSVCoordenadas(content);

      // Caragamamos csv covid
      fetch("src/WHO-COVID-19-global-data.csv")
        .then((response) => {
          if (!response.ok) {
            throw new Error("Error: " + response.statusText);
          }
          return response.text();
        })
        .then((content) => {
          procesarCSVCovid(content);

          // Fusionamos los datos
          uniqueDates = [...new Set(datosCovid.map((d) => d.date))].sort();
          mergedData = mergeData();

          // Creamos los marcadores (invisibles inicialmente)
          createMarkers();
        })
        .catch((error) => {
          console.error("Error al cargar el archivo:", error);
        });
    })
    .catch((error) => {
      console.error("Error al cargar el archivo:", error);
    });
}

//Procesamiento datos csv
function procesarCSVCovid(content) {
  const sep = ","; // separador ;
  const filas = content.split("\n");

  const encabezados = filas[0].split(sep); // Separamos los encabezados por su separador ;
  // Obtenemos los índices de las columnas
  const indices = {
    date: encabezados.indexOf("Date_reported"),
    country_code: encabezados.indexOf("Country_code"),
    country: encabezados.indexOf("Country"),
    new_cases: encabezados.indexOf("New_cases"),
    cum_cases: encabezados.indexOf("Cumulative_cases"),
    new_deaths: encabezados.indexOf("New_deaths"),
    cum_deaths: encabezados.indexOf("Cumulative_deaths"),
  };
  console.log(indices);

  // Extraemos los datos
  for (let i = 1; i < filas.length; i++) {
    const columna = filas[i].split(sep); // separador ;
    if (columna.length > 1) {
      datosCovid.push({
        date: columna[indices.date],
        country_code: columna[indices.country_code],
        country: columna[indices.country],
        new_cases: columna[indices.new_cases],
        cum_cases: columna[indices.cum_cases],
        new_deaths: columna[indices.new_deaths],
        cum_deaths: columna[indices.cum_deaths],
      });
    }
  }
  console.log("COVID CSV cargado:", datosCovid.length, "filas");
}

//Procesamiento datos csv
function procesarCSVCoordenadas(content) {
  const sep = ","; // separador ;
  const filas = content.split("\n");

  const encabezados = filas[0].split(sep); // Separamos los encabezados por su separador ;
  // Obtenemos los índices de las columnas
  const indices = {
    country_code: encabezados.indexOf("country_code"),
    lat: encabezados.indexOf("latitude"),
    lon: encabezados.indexOf("longitude"),
    country: encabezados.indexOf("country"),
  };
  console.log(indices);

  // Extraemos los datos
  for (let i = 1; i < filas.length; i++) {
    const columna = filas[i].split(sep); // separador ;
    if (columna.length > 1) {
      datosGeo.push({
        country_code: columna[indices.country_code],
        lat: columna[indices.lat],
        lon: columna[indices.lon],
        country: columna[indices.country],
      });
    }
  }
  console.log("Archivo csv coordenadas cargado");
}

// Fusionamos los datos
function mergeData() {
  const covidByCountry = {};
  datosCovid.forEach((d) => {
    if (!covidByCountry[d.country_code]) covidByCountry[d.country_code] = [];
    covidByCountry[d.country_code].push(d);
  });

  return datosGeo
    .filter((g) => g.lat && g.lon)
    .map((g) => ({
      ...g,
      timeSeries: covidByCountry[g.country_code] || [],
    }));
}

function Plano(px, py, pz, sx, sy, txt, dismap) {
  let geometry = new THREE.PlaneBufferGeometry(sx, sy, 200, 200);
  let material = new THREE.MeshPhongMaterial({
    wireframe: false,
  });

  //Textura
  if (txt != undefined) {
    material.map = txt;
  }

  if (dismap != undefined) {
    material.displacementMap = dismap;
    material.displacementScale = 0.1;
  }

  let mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(px, py, pz);
  scene.add(mesh);

  return mesh; // Devolvemos la mesh
}

function Planeta(
  radio,
  dist,
  vel,
  col,
  f1,
  f2,
  texture = undefined,
  texbump = undefined,
  texspec = undefined,
  texalpha = undefined,
  sombra = false
) {
  let geometry = new THREE.SphereBufferGeometry(radio, 20, 20);
  let material = new THREE.MeshPhongMaterial({ color: col });

  //Textura
  if (texture != undefined) {
    material.map = texture;
  }
  //Rugosidad
  if (texbump != undefined) {
    material.bumpMap = texbump;
    material.bumpScale = 0.1;
  }

  //Especular
  if (texspec != undefined) {
    material.specularMap = texspec;
    material.specular = new THREE.Color("orange");
  }

  //Transparencia
  if (texalpha != undefined) {
    //Con mapa de transparencia
    material.alphaMap = texalpha;
    material.transparent = true;
    material.side = THREE.DoubleSide;
    material.opacity = 1.0;

    //Sin mapa de transparencia
    /*material.transparent = true;
    material.side = THREE.DoubleSide;
    material.opacity = 0.8;
    material.transparent = true;
    material.depthWrite = false;*/
  }

  let planeta = new THREE.Mesh(geometry, material);

  planeta.userData.dist = dist;
  planeta.userData.speed = vel;
  planeta.userData.f1 = f1;
  planeta.userData.f2 = f2;

  planeta.position.set(dist * f1, 0, 0);

  // Por último, añadimos los planetas a la lista Planetas y a la escena
  Planetas.push(planeta);
  scene.add(planeta);

  // Dibuja trayectoria en el plano XZ (no XY)
  let curve = new THREE.EllipseCurve(
    0,
    0, // centro
    dist * f1,
    dist * f2, // radios elipse
    0,
    2 * Math.PI, // ángulo inicial y final
    false, // sentido antihorario
    0 // rotación
  );

  // Convertimos puntos XY → XZ
  let points = curve.getPoints(100).map((p) => new THREE.Vector3(p.x, 0, p.y));
  let geome = new THREE.BufferGeometry().setFromPoints(points);
  let mate = new THREE.LineBasicMaterial({ color: 0xffffff });
  // Objeto
  let orbita = new THREE.Line(geome, mate);
  scene.add(orbita);
  planeta.userData.orbita = orbita; // Asociamos la órbita al planeta
}

// Transformamos de coordenadas geográficas a coordenadas de plano
function latLonToPlane(lat, lon, mapsx, mapsy) {
  const x = (lon / 180) * (mapsx / 2);
  const y = (lat / 90) * (mapsy / 2);
  return { x, y };
}

// Transformamos las coordenadas geográficas a coordenadas de la esfera
function latLonToSphere(lat, lon, radius) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);

  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.sin(theta);

  return { x, y, z };
}

// Creamos las barras (crecen en Z según casos/muertes)
function createMarkers() {
  mergedData.forEach((country) => {
    const pos2D = latLonToPlane(country.lat, country.lon, mapsx, mapsy); // Posición en plano 2D

    let pos = latLonToSphere(country.lat, country.lon, 2.02); // Posición inicial en el plano 3D sin rotar (textura no alineada)

    const v = new THREE.Vector3(pos.x, pos.y, pos.z); // Rotamos para alinear con la textura

    const pos3D = { x: v.x, y: v.y, z: v.z }; // Posición 3D corregida

    // Geometría de barra
    const geometry = new THREE.BoxGeometry(0.04, 0.04, 0.01);
    const material = new THREE.MeshBasicMaterial({
      color: colourByCountry(country.country),
    });

    const bar = new THREE.Mesh(geometry, material);
    bar.position.set(pos2D.x, pos2D.y, 0.005);
    bar.userData.pos2D = pos2D;
    bar.userData.pos3D = pos3D;

    bar.visible = false;

    scene.add(bar);

    puntos.push({ mesh: bar, data: country });
  });
}

// Actualizamos las barras
function updateMarkers(date) {
  puntos.forEach(({ mesh, data }) => {
    const record = data.timeSeries.find((r) => r.date === date);

    if (!record) {
      mesh.visible = false;
      return;
    }

    const raw = record[metric];
    const num = raw !== undefined && raw !== "" ? parseInt(raw, 10) : 0;

    const height = Math.sqrt(num) * 0.005; // escala ajustable
    const scale = height / 0.01;
    mesh.scale.set(1, 1, scale);

    mesh.scale.set(1, 1, scale);

    if (act3D) {
      const base = new THREE.Vector3(
        mesh.userData.pos3D.x,
        mesh.userData.pos3D.y,
        mesh.userData.pos3D.z
      );

      const normal = base.clone().normalize();

      const offset = normal.clone().multiplyScalar(height / 2);

      mesh.position.copy(base.clone().add(offset));

      mesh.lookAt(base.clone().multiplyScalar(2));
    } else {
      mesh.position.z = height / 2;
    }

    mesh.visible = num > 0;
  });
}

function updateViewMode() {
  scene.children.forEach((obj) => {
    if (
      obj.geometry instanceof THREE.PlaneGeometry ||
      obj.geometry instanceof THREE.PlaneBufferGeometry
    ) {
      obj.visible = !act3D;
    }
  });

  Planetas[0].visible = act3D;

  puntos.forEach(({ mesh }) => {
    if (act3D) {
      mesh.position.set(
        mesh.userData.pos3D.x,
        mesh.userData.pos3D.y,
        mesh.userData.pos3D.z
      );
      mesh.rotation.set(0, 0, 0);
    } else {
      mesh.position.set(mesh.userData.pos2D.x, mesh.userData.pos2D.y, 0.005);
      mesh.rotation.set(0, 0, 0);
    }
  });
}

function updatePanel(date) {
  const panel = document.getElementById("rankingPanel");
  if (!panel) return;

  const ranking = mergedData
    .map((country) => {
      const record = country.timeSeries.find((r) => r.date === date);
      let val = 0;
      if (record) {
        // Elegimos el valor según la métrica activa
        val =
          record[metric] !== undefined && record[metric] !== ""
            ? parseInt(record[metric], 10)
            : 0;
      }
      return {
        country: country.country,
        value: val,
        color: colourByCountry(country.country),
      };
    })
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 10); // Top 10

  let titulo = "";
  switch (metric) {
    case "cum_cases":
      titulo = "Top 10 países por casos acumulados";
      break;
    case "cum_deaths":
      titulo = "Top 10 países por muertes acumuladas";
      break;
    case "new_cases":
      titulo = "Top 10 países por casos nuevos";
      break;
    case "new_deaths":
      titulo = "Top 10 países por muertes nuevas";
      break;
  }

  panel.innerHTML = `<b>${titulo}</b><br><br>`;

  ranking.forEach((d) => {
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.marginBottom = "4px";

    const colorBox = document.createElement("span");
    colorBox.style.display = "inline-block";
    colorBox.style.width = "12px";
    colorBox.style.height = "12px";
    colorBox.style.marginRight = "6px";
    colorBox.style.backgroundColor = d.color;
    colorBox.style.border = "1px solid #333";

    const text = document.createElement("span");
    text.textContent = `${d.country}: ${d.value.toLocaleString()}`;

    row.appendChild(colorBox);
    row.appendChild(text);
    panel.appendChild(row);
  });
}

// Mostramos un panel con información acerca de la información que se está representando
function showTooltip(x, y, countryInfo) {
  let tooltip = document.getElementById("tooltipPais");

  if (!tooltip) {
    tooltip = document.createElement("div");
    tooltip.id = "tooltipPais";
    document.body.appendChild(tooltip);
  }

  const date = uniqueDates[currentDateIndex];
  const record = countryInfo.data.timeSeries.find((r) => r.date === date);

  const latest = record || countryInfo.data.timeSeries.at(-1) || {};
  const cum_cases = parseInt(latest.cum_cases || 0).toLocaleString();
  const cum_deaths = parseInt(latest.cum_deaths || 0).toLocaleString();
  const new_cases = parseInt(latest.new_cases || 0).toLocaleString();
  const new_deaths = parseInt(latest.new_deaths || 0).toLocaleString();

  let contenido = `<b style="color:white">${countryInfo.data.country}</b><br>`;

  switch (metric) {
    case "cum_cases":
      contenido += `• Casos acumulados (${date}): <b>${cum_cases}</b>`;
      break;
    case "cum_deaths":
      contenido += `• Muertes acumuladas (${date}): <b>${cum_deaths}</b>`;
      break;
    case "new_cases":
      contenido += `• Casos nuevos (${date}): <b>${new_cases}</b>`;
      break;
    case "new_deaths":
      contenido += `• Muertes nuevas (${date}): <b>${new_deaths}</b>`;
      break;
    default:
      contenido += `• Casos: ${casos}<br>Muertes: ${cum_deaths}`;
  }

  tooltip.innerHTML = contenido;
  tooltip.style.left = `${x + 10}px`;
  tooltip.style.top = `${y + 10}px`;
  tooltip.style.display = "block";
}

// Genera un color fijo para cada país según su nombre
function colourByCountry(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const color = (hash & 0x00ffffff).toString(16).toUpperCase();
  return "#" + "00000".substring(0, 6 - color.length) + color;
}

// Resaltamos la opción que se está representando
function highlightActiveMetric(selectedValue) {
  metricButtons.forEach(({ id, value }) => {
    const b = document.getElementById(id);
    if (value === selectedValue) {
      b.style.backgroundColor = "#4CAF50";
      b.style.color = "white";
    } else {
      b.style.backgroundColor = "";
      b.style.color = "";
    }
  });
}

function actualizarFecha(date) {
  const fechaActual = new Date(date); // Actualizamos la fecha a la actual

  // Opciones de salida
  const opciones = {
    year: "numeric",
    month: "long",
    day: "numeric",
  };

  fecha2show.innerHTML =
    "Actualización de casos/muertes semanales por COVID-19: " +
    fechaActual.toLocaleString("es-ES", opciones) +
    "<br><small>Autor: Néstor Déniz González</small>";
}

// Animamos por fechas
function animateByDate(time) {
  if (uniqueDates.length === 0 || isPaused) return;

  if (time - lastUpdateTime > updateInterval) {
    const date = uniqueDates[currentDateIndex];
    updateMarkers(date);
    updatePanel(date);
    actualizarFecha(date);

    currentDateIndex = (currentDateIndex + 1) % uniqueDates.length;
    lastUpdateTime = time;
  }
}

function animate(time) {
  requestAnimationFrame(animate);

  camcontrols.update();

  animateByDate(time);

  renderer.render(scene, camera);
}

function onMouseClick(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(puntos.map((p) => p.mesh));

  if (intersects.length > 0) {
    const intersected = intersects[0].object; // Objeto intersectado
    const countryInfo = puntos.find((p) => p.mesh === intersected); // Buscamos a que país pertenece

    if (countryInfo) {
      showTooltip(event.clientX, event.clientY, countryInfo);
      return; // Retornamos para no ocultar el tooltip
    }
  }

  // Si se hace click fuera de un país, se oculta.
  const tooltip = document.getElementById("tooltipPais");
  if (tooltip) {
    tooltip.style.display = "none";
  }
}
