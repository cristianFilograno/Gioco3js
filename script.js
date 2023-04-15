import * as THREE from 'three';
import * as CANNON from 'https://cdn.skypack.dev/cannon-es';


let camera, scene, renderer; // thre JS globals
let world; //CannonJs
let stack; // creiamo dei record e abbiamo la possibilità di capire l'altezza (y) sulla base della lunghezza di questo array
let overhangs;
const boxHeight = 1; //altezza di ogni layer
const originalBoxSize = 3

init();

// le cose che devono succedere all'inizio, e richiameremo sta funzione ogni nuovo layer(?)
function init() {
    stack = [];
    overhangs = [];
    
    // INIZIALIZZIAMO CANNON
    world = new CANNON.World();
    world.gravity.set(0, -10, 0); //AGGIUGNIAMO GRAVITà
    world.broadphase = new CANNON.NaiveBroadphase();
    world.solver.iterations = 40;

    // INIZIALIZZIAMO 3JS
    const aspect = window.innerWidth / window.innerHeight
    const width = 10;
    const height = width / aspect;

    camera = new THREE.OrthographicCamera(
        width / -2, // left
        width / 2, // right
        height / 2, // top
        height / -2, // bottom
        0, // near
        100 // far
    );
    // posizione (indifferente nell'ortographic affinche rimangano le proporzioni)
    camera.position.set(4, 4, 4);
    // direzione
    camera.lookAt(0, 0, 0);

    // SCENA
    scene = new THREE.Scene();

    // QUADRATO BASE
    addLayer(0, 0, originalBoxSize, originalBoxSize);

    // PRIMO LAYER (x, z, width, depth, direction)
    addLayer(-10, 0, originalBoxSize, originalBoxSize, "x"); 

    // SETTIAMO LE LUCI
    //ambient è lumisono da tutti i lati
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight.position.set(10, 20, 0); //x un po di luce, y tanta luce, z niente luce
    scene.add(directionalLight);



    // RENDERER
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    // renderer.setAnimationLoop(animation);
    // renderer.render(scene, camera);

    // aggiungi all'html
    document.body.appendChild(renderer.domElement);
}





function addLayer(x,z, width, depth, direction) {
    const y = boxHeight * stack.length; //aggiunge il nuovo quadrato, un layer piu sopra?

    // la massa (false) sarà 0, non controllata da cannon js
    const layer = generateBox(x, y, z, width, depth, false);
    layer.direction = direction;

    stack.push(layer);
}

function addOverhang(x,z, width, depth) {
    const y = boxHeight * (stack.length - 1);//non va un livello sopra, ma rimane allo stesso livello

    // la massa (true) sarà 5, controllata da cannon js
    const overhang = generateBox(x, y, z, width, depth, true);

    overhangs.push(overhang);
}

function generateBox(x, y, z, width, depth, falls){
    const geometry = new THREE.BoxGeometry(width, boxHeight, depth);

    // aggiungiamo 4° di luce ogni layer
    const color = new THREE.Color(`hsl(${30 + stack.length * 4}, 100%, 50%)`);
    const material = new THREE.MeshLambertMaterial({ color });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);

    scene.add(mesh);

    // stessa cosa sopra ma per cannon js setti la distanza del centro dai lati, quindi dividi ogni dimensione per 2
    const shape = new CANNON.Box(
        new CANNON.Vec3(width / 2, boxHeight / 2, depth / 2)
    );
    // non hanno material, ma mass che subisce la forza di gravità, mass=0 è fermo nello spazio
    let mass = falls ? 5 : 0;
    mass *= width / originalBoxSize; // Reduce mass proportionately by size
    mass *= depth / originalBoxSize; // Reduce mass proportionately by size
    
    const body = new CANNON.Body({mass, shape});
    // si posiziona allo stesso modo
    body.position.set(x, y, z);
    world.addBody(body);

    // cio che viene passato allo stack oltre la direction
    return{
        // si poteva mettere solo mesh ma sta cosi a scopo didattico
        threejs: mesh,
        cannonjs: body,
        width,
        depth,
    };
}

function cutBox(topLayer, overlap, size, delta){
    const direction = topLayer.direction;
    //SE L'OVERLAP è POSITIVO VUOL DIRE CHE ABBIAMO CENTRATO IL BOX E CONTINUIAMO IL GIOCO
    const newWidth = direction == "x" ? overlap : topLayer.width;
    const newDepth = direction == "z" ? overlap : topLayer.depth;
    
    // UPDATE METADATA
    topLayer.width = newWidth;
    topLayer.depth = newDepth;
    // SCALE DEL MESH CON LA PROPORZIONE DELLA NUOVA E VECCHIA MISURA (CAMBIAMO LE MISURE MA NON IL CENTRO, PERCHè IN QEUSTO CASO I 2 BOXES SONO UGUALI)

    topLayer.threejs.scale[direction] = overlap / size;
    topLayer.threejs.position[direction] -= delta / 2;

    topLayer.cannonjs.position[direction] -= delta / 2;

    const shape = new CANNON.Box(
        new CANNON.Vec3(newWidth / 2, boxHeight / 2, newDepth / 2)
    );
    topLayer.cannonjs.shapes = [];
    topLayer.cannonjs.addShape(shape);
}



renderer.render(scene, camera);

// // AGGIUNGIAMO UN SOLO CUBO ALLA SCENA, CHE POI DIVENTANO I PRIMI 2 LAYER SOPRA
// const geometry = new THREE.BoxGeometry(3,1,3);
// const material = new THREE.MeshLambertMaterial( { color: 0xfb8e00 } );
// const mesh = new THREE.Mesh(geometry,material);
// mesh.position.set(0, 0, 0);
// scene.add(mesh);





let gameStarted = false;

window.addEventListener("click", () => {
    // se il gioco non è partito, il click lo starta
    if (!gameStarted) {
        renderer.setAnimationLoop(animation);
        gameStarted = true;
    // se il gioco è partito, il click stoppa il box che si sta muovendo e ne aggiunge un altro
    } else {
        // PRENDIAMO IN CONSIDERAZIONE LE DUE BOX
        const topLayer = stack[stack.length - 1];
        const previousLayer = stack[stack.length - 2];

        // SAPPIAMO LA DIREZIONE O X O Z
        const direction = topLayer.direction;

         //SE CI MUOVIAMO SULL'ASSE X LA SIZE SARà LA WIDTH, SULL'ASSE X SARà LA PROFONDITà
         const size = direction == "x" ? topLayer.width : topLayer.depth;

        // CALCOLIAMO IL DELTA SOTTRAENDO LE DIREZIONI E OTTENIAMO LA PARTE IN COMUNE
        const delta = topLayer.threejs.position[direction] - previousLayer.threejs.position[direction];

        // PRENDIAMO IL VALORE ASSOLUTO DI DELTA
        const overhangSize = Math.abs(delta);

        const overlap = size - overhangSize;
        console.log(overlap)


        if (overlap > 0) {
            cutBox(topLayer, overlap, size, delta)

             // OVERHANG, la parte fuori dal box 
            const overhangShift = (overlap / 2 + overhangSize / 2) * Math.sign(delta);
            const overhangX = direction == "x" ? topLayer.threejs.position.x + overhangShift : topLayer.threejs.position.x;
            const overhangZ = direction == "z" ? topLayer.threejs.position.z + overhangShift : topLayer.threejs.position.z;
            const overhangWidth = direction == "x" ? overhangSize :topLayer.width;
            const overhangDepth = direction == "z" ? overhangSize : topLayer.depth;

            addOverhang(overhangX, overhangZ, overhangWidth, overhangDepth);


            // layer successivo si switcha sempre tra x e z
            const nextX = direction == "x" ? topLayer.threejs.position.x : -10;
            const nextZ = direction == "z" ? topLayer.threejs.position.z : -10;
            const newWidth = topLayer.width;
            const newDepth = topLayer.depth; 
            const nextDirection = direction == "x" ? "z" : "x";

            addLayer(nextX, nextZ, newWidth, newDepth, nextDirection);

        }
         else {
            alert("hai perso")
            init()
        }

       


    }
    // animazione che muoverà la box verso l'infinito
    function animation() {
        const speed = 0.1;
    
        const topLayer = stack[stack.length - 1];
        topLayer.threejs.position[topLayer.direction] += speed;
        // update di cannon
        topLayer.cannonjs.position[topLayer.direction] += speed;
    
        // 4 è l'altezza iniziale della camera
        if (camera.position.y < boxHeight * (stack.length - 2) + 4) {
            camera.position.y +=speed;
        }
        updatePhysics();
        renderer.render(scene, camera);
    }

    function updatePhysics(){
        world.step(1 / 60);

        overhangs.forEach((element) => {
            element.threejs.position.copy(element.cannonjs.position);
            element.threejs.quaternion.copy(element.cannonjs.quaternion)
        });
    }

});









