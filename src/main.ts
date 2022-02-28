import { promises as fsPromises } from 'fs';
import * as path from 'path';
import * as THREE from "three";
import { BoxBufferGeometry, Mesh } from "three";
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { OutlineEffect } from 'three/examples/jsm/effects/OutlineEffect';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';
import GUI from 'lil-gui';

window.addEventListener("DOMContentLoaded", () => {
    // アプリケーションの起動
    STLViewer.Application.run();
});

module STLViewer {
    //let container;
    var container;
    let scene, camera, renderer, effect;
    let orbitControls;
    var planes, planeObjects, object;
    let gui, params, bTransparent, bCrosssection, bAnimation, bDisassemble;
    var raycaster, mouse;
    var clickObject = [];
    const manager = new THREE.LoadingManager();
    var startTime, endTime;

    export class Application {
        static run() {
            try {
                //container = document.getElementById('myCanvas');
                renderer = new THREE.WebGLRenderer({
                    antialias: true,
                    preserveDrawingBuffer: true,
                });
                renderer.setClearColor(0xffffff, 1);
                renderer.setPixelRatio(window.devicePixelRatio);
                renderer.setSize(window.innerWidth, window.innerHeight);
                //renderer.localClippingEnabled = true;
                //container.appendChild(renderer.domElement);
                document.body.appendChild(renderer.domElement);

                scene = new THREE.Scene();
                raycaster = new THREE.Raycaster();
                mouse = new THREE.Vector2()

                camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 10000);
                camera.position.z = 100;
                camera.position.y = 40
                camera.position.x = 60
                camera.target = new THREE.Vector3();

                orbitControls = new OrbitControls(camera, renderer.domElement);
                orbitControls.minDistance = 1;
                orbitControls.maxDistance = 10000;

                scene.add(new THREE.AmbientLight(0x666666));

                var light = new THREE.DirectionalLight(0xaaaaaa, 1);
                light.position.set(1, 0.75, 0.5);
                scene.add(light);

                var light = new THREE.DirectionalLight(0xaaaaaa, 1);
                light.position.set(-1, 0.75, -0.5);
                scene.add(light);

                drawGround();

                // NOTE: Setup Plane
                planes = [
                    new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0),
                ];

                object = new THREE.Group();
                //object.scale.set(10, 10, 10);
                scene.add(object);

                //var globalPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
                //renderer.clippingPlanes.push(globalPlane);

                //effect = new OutlineEffect(renderer, {
                //    defaultThickness: 0.003,
                //    defaultColor: [ 0, 0, 0 ],
                //    defaultAlpha: 1.0,
                //    defaultKeepAlive: true
                //});

                //ウィンドウのリサイズに対応
                window.addEventListener('resize', function () {
                    camera.aspect = window.innerWidth / window.innerHeight;
                    camera.updateProjectionMatrix();
                    renderer.setSize(window.innerWidth, window.innerHeight);
                }, false);

                renderer.domElement.addEventListener('click', onClick, false);

                //onWindowResize();
                showGUI();
                render();
            }
            catch (e) {
                alert(e);
            }

            function onDocumentMouseUp(event)
            {
                event.preventDefault();
            }

            function onClick(event)
            {
                event.preventDefault();

                mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
                mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

                raycaster.setFromCamera(mouse, camera);

                var intersects = raycaster.intersectObject(scene, true);

                if (intersects.length > 0) {
                    var objects = intersects.filter(item => item.object.name === "frontMesh");
                    if (objects && 0 < objects.length) {
                        var mesh = objects[0].object;
                        var children = mesh.children;

                        var clear = false;
                        if (clickObject && 0 < clickObject.length) {
                            for (var cI = 0; cI < children.length; cI++) {
                                var index = clickObject.findIndex(item => item.id === children[cI].id);
                                if (-1 < index) {
                                    clickObject[index].material.color.set(0x000000);
                                    clickObject = clickObject.filter(item => item.id !== children[cI].id);
                                    clear = true;
                                }
                            }
                        }

                        if (!clear) {
                            for (var cI = 0; cI < children.length; cI++) {
                                children[cI].material.color.set(0xFF0000);
                                clickObject.push(children[cI]);
                            }
                        }
                    }
                }
                else {
                    if (clickObject && 0 < clickObject.length) {
                        for (var cI = 0; cI < clickObject.length; cI++) {
                            clickObject[cI].material.color.set(0x000000);
                        }
                        clickObject = [];
                    }
                }

                render();
            }

            function showGUI()
            {
                params = {
                    "LoadSTL": function () { OnLoadStl() },
                    "Clear": function () { OnClearStl() },
                    "Transparent": false,
                    "CrossSection": false,
                    "Animation": false,
                    "Disassemble": false,
                    "ZoomToFit": function () { OnZoomToFit() },
                    "ZoomToSelection": function () { OnZoomToSelection() },
                    "ScreenShot": function () { OnScreenShot() },
                    "FullScreen": function () { OnFullScreen() },
                    "ExitFullScreen": function () { OnExitFullScreen() }
                };

                gui = new GUI();
                gui.add(params, "LoadSTL");
                gui.add(params, "Clear");
                gui.add(params, "Transparent").onChange(function (value) {
                    bTransparent = value;
                    SetTransparent();
                });
                gui.add(params, "CrossSection").onChange(function (value) {
                    bCrosssection = value;
                    SetCrossSection();
                });
                gui.add(params, "Animation").onChange(function (value) {
                    bAnimation = value;
                });
                gui.add(params, "Disassemble").onChange(function (value) {
                    bDisassemble = value;
                    SetDisassemble();
                });
                gui.add(params, "ZoomToFit");
                gui.add(params, "ZoomToSelection");
                gui.add(params, "ScreenShot");
                gui.add(params, "FullScreen");
                gui.add(params, "ExitFullScreen");
            }

            function SetDisassemble()
            {
                var objects = object.children.filter(item => item.name === "frontMesh");
                if (bDisassemble) {
                    const boundingBox = new THREE.Box3();
                    for (var cI = 0; cI < objects.length; cI++) {
                        if (0 === cI) {
                            continue;
                        }

                        var mesh = objects[cI];

                        var size = new THREE.Vector3();
                        boundingBox.getSize(size);

                        mesh.position.set(0.0, size.y - 5.0, 0.0);
                        boundingBox.setFromObject(mesh);
                    }
                }
                else {
                    for (var cI = 0; cI < objects.length; cI++) {
                        var mesh = objects[cI];
                        mesh.position.set(0.0, 0.0, 0.0);
                    }
                }
            }

            function OnFullScreen()
            {
                document.body.requestFullscreen();	
            }

            function OnExitFullScreen()
            {
                document.exitFullscreen();
            }

            function OnScreenShot()
            {
                try {
                    let downloadLink = document.createElement('a');
                    downloadLink.setAttribute('download', 'image.png');
                    let canvas = document.getElementsByTagName("canvas")[0];
                    let dataURL = canvas.toDataURL('image/png');
                    let url = dataURL.replace(/^data:image\/png/, 'data:application/octet-stream');
                    downloadLink.setAttribute('href', url);
                    downloadLink.click();
                }
                catch (e) {
                    alert(e);
                }
            }

            function OnZoomToFit()
            {
                var objects = object.children.filter(item => item.name === "frontMesh");
                fitCameraToSelection(camera, orbitControls, objects);
            }

            function OnZoomToSelection() {
                if (!clickObject || 1 > clickObject.length) {
                    return;
                }

                const selection = [];
                for (var cI = 0; cI < clickObject.length; cI++) {
                    selection.push(clickObject[cI]);
                }
                fitCameraToSelection(camera, orbitControls, selection);
            }

            function fitCameraToSelection(camera, controls, selection, fitOffset = 1.3)
            {
                const size = new THREE.Vector3();
                const center = new THREE.Vector3();
                const box = new THREE.Box3();

                box.makeEmpty();
                for (var cI = 0; cI < selection.length; cI++) {
                    box.expandByObject(selection[cI]);
                }

                box.getSize(size);
                box.getCenter(center);

                const maxSize = Math.max(size.x, size.y, size.z);
                const fitHeightDistance = maxSize / (2 * Math.atan(Math.PI * camera.fov / 360));
                const fitWidthDistance = fitHeightDistance / camera.aspect;
                const distance = fitOffset * Math.max(fitHeightDistance, fitWidthDistance);

                const direction = controls.target.clone()
                    .sub(camera.position)
                    .normalize()
                    .multiplyScalar(distance);

                controls.maxDistance = distance * 10;
                controls.target.copy(center);

                camera.near = distance / 100;
                camera.far = distance * 100;
                camera.updateProjectionMatrix();

                camera.position.copy(controls.target).sub(direction);

                controls.update();
            }

            const fitCameraToCenteredObject = function (camera, object, offset, controls) {
                const boundingBox = new THREE.Box3();
                boundingBox.setFromObject(object);

                var middle = new THREE.Vector3();
                var size = new THREE.Vector3();
                boundingBox.getSize(size);

                // figure out how to fit the box in the view:
                // 1. figure out horizontal FOV (on non-1.0 aspects)
                // 2. figure out distance from the object in X and Y planes
                // 3. select the max distance (to fit both sides in)
                //
                // The reason is as follows:
                //
                // Imagine a bounding box (BB) is centered at (0,0,0).
                // Camera has vertical FOV (camera.fov) and horizontal FOV
                // (camera.fov scaled by aspect, see fovh below)
                //
                // Therefore if you want to put the entire object into the field of view,
                // you have to compute the distance as: z/2 (half of Z size of the BB
                // protruding towards us) plus for both X and Y size of BB you have to
                // figure out the distance created by the appropriate FOV.
                //
                // The FOV is always a triangle:
                //
                //  (size/2)
                // +--------+
                // |       /
                // |      /
                // |     /
                // | Fﾂｰ /
                // |   /
                // |  /
                // | /
                // |/
                //
                // Fﾂｰ is half of respective FOV, so to compute the distance (the length
                // of the straight line) one has to: `size/2 / Math.tan(F)`.
                //
                // FTR, from https://threejs.org/docs/#api/en/cameras/PerspectiveCamera
                // the camera.fov is the vertical FOV.

                const fov = camera.fov * (Math.PI / 180);
                const fovh = 2 * Math.atan(Math.tan(fov / 2) * camera.aspect);
                let dx = size.z / 2 + Math.abs(size.x / 2 / Math.tan(fovh / 2));
                let dy = size.z / 2 + Math.abs(size.y / 2 / Math.tan(fov / 2));
                let cameraZ = Math.max(dx, dy);

                // offset the camera, if desired (to avoid filling the whole canvas)
                if (offset !== undefined && offset !== 0) cameraZ *= offset;

                camera.position.set(0, 0, cameraZ);

                // set the far plane of the camera so that it easily encompasses the whole object
                const minZ = boundingBox.min.z;
                const cameraToFarEdge = (minZ < 0) ? -minZ + cameraZ : cameraZ - minZ;

                camera.far = cameraToFarEdge * 3;
                camera.updateProjectionMatrix();

                if (controls !== undefined) {
                    // set camera to rotate around the center
                    controls.target = new THREE.Vector3(0, 0, 0);

                    // prevent camera from zooming out far enough to create far plane cutoff
                    controls.maxDistance = cameraToFarEdge * 2;
                }
            };

            function OnLoadStl()
            {
                OnClearStl();
                loadStlModel();
            }

            function OnClearStl()
            {
                object.children = object.children.filter(item => item.name === "");
                params.Transparent = false;
                params.CrossSectoin = false;
                params.Animation = false;
                params.Disassemble = false;
            }

            function SetTransparent()
            {
                SetCrossSection();
            }

            function SetCrossSection() {
                try {
                    if (null == object) {
                        return;
                    }

                    renderer.localClippingEnabled = bCrosssection;
                    // Set up clip plane rendering
                    planeObjects = [];

                    var index = 0;
                    var children = object.children;
                    for (var cI = 0; cI < children.length; cI++) {
                        const frontmat = new THREE.MeshPhysicalMaterial({
                            color: 0xF2F2F2,
                            metalness: 0.25,
                            roughness: 0.1,
                            opacity: bTransparent ? 0.7 : 0.0,
                            transparent: bTransparent,
                            transmission: 0.99,
                            clearcoat: 1.0,
                            clearcoatRoughness: 0.25,
                            polygonOffset: true,
                            polygonOffsetFactor: 1, // positive value pushes polygon further away
                            polygonOffsetUnits: 1,
                            clippingPlanes: bCrosssection ? planes : [],
                            clipShadows: true,
                            shadowSide: THREE.DoubleSide,
                        });

                        const backmat = new THREE.MeshLambertMaterial({
                            color: 0x000000,
                            side: THREE.BackSide,
                            clippingPlanes: bCrosssection ? planes : [],
                        })

                        const edgeMat = new THREE.LineBasicMaterial({
                            color: 0x000000,
                            side: THREE.FrontSide,
                            clippingPlanes: bCrosssection ? planes : [],
                        });

                        if ("frontMesh" === children[cI].name) {
                            var frontMesh = children[cI];
                            frontMesh.material = frontmat;

                            var frontChildren = frontMesh.children;
                            for (var cJ = 0; cJ < frontChildren.length; cJ++) {
                                var childMesh = frontChildren[cJ];
                                if (childMesh.name === "edge") {
                                    childMesh.material = edgeMat;
                                }
                                else if (childMesh.name == "backMesh") {
                                    childMesh.material = backmat;
                                }
                                
                                frontChildren[cJ] = childMesh;
                            }

                            children[cI] = frontMesh;

                            if (bCrosssection) {
                                var planeGeom = new THREE.PlaneBufferGeometry(1000, 1000);
                                for (var i = 0; i < planes.length; i++) {
                                    var poGroup = new THREE.Group();
                                    poGroup.name = "poGroup";
                                    var plane = planes[i];
                                    var stencilGroup = createPlaneStencilGroup(frontMesh.geometry, plane, i + 1 + index);
                                    stencilGroup.name = "stencilGroup";

                                    // plane is clipped by the other clipping planes
                                    var planeMat = new THREE.MeshStandardMaterial({
                                        color: 0xF2F2F2,
                                        metalness: 0.25,
                                        roughness: 0.1,
                                        opacity: bTransparent ? 0.7 : 0.0,
                                        transparent: bTransparent,

                                        clippingPlanes: planes.filter(p => p !== plane),

                                        stencilWrite: true,
                                        stencilRef: 0,
                                        stencilFunc: THREE.NotEqualStencilFunc,
                                        stencilFail: THREE.ReplaceStencilOp,
                                        stencilZFail: THREE.ReplaceStencilOp,
                                        stencilZPass: THREE.ReplaceStencilOp,
                                    });

                                    var po = new THREE.Mesh(planeGeom, planeMat);
                                    po.name = "planeMesh";
                                    po.onAfterRender = function (renderer) {
                                        renderer.clearStencil();
                                    };

                                    po.renderOrder = i + 1.1 + index;
                                    object.add(stencilGroup);
                                    poGroup.add(po);
                                    planeObjects.push(po);
                                    scene.add(poGroup);
                                }
                            }

                            if (!bTransparent) {
                                var findex = object.children.findIndex(item => item.name === "backMesh");
                                if (-1 < findex) continue;

                                var clippedColorBack = new THREE.Mesh(frontMesh.geometry, backmat);
                                clippedColorBack.name = "backMesh";
                                frontMesh.add(clippedColorBack);
                            }
                            else {
                                frontMesh.children = frontMesh.children.filter(item => item.name !== "backMesh");
                            }

                            index++;
                        }

                        backmat.onBeforeCompile = (shader) => {
                            const token = '#include <begin_vertex>'
                            const customTransform = `vec3 transformed = position + objectNormal*0.05;`
                            shader.vertexShader = shader.vertexShader.replace(token, customTransform)
                        }
                    }

                    if (!bCrosssection) {
                        object.children = object.children.filter(item => item.name !== "stencilGroup");
                        scene.children = scene.children.filter(item => item.name !== "poGroup");
                    }
                }
                catch (e) {
                    alert(e);
                }
            }

            function createPlaneStencilGroup(geometry, plane, renderOrder) {

                var group = new THREE.Group();

                var baseMat = new THREE.MeshBasicMaterial();
                baseMat.depthWrite = false;
                baseMat.depthTest = false;
                baseMat.colorWrite = false;
                baseMat.stencilWrite = true;
                baseMat.opacity = bTransparent ? 0.7 : 0.0;
                baseMat.transparent = bTransparent;
                baseMat.stencilFunc = THREE.AlwaysStencilFunc;

                // back faces
                var mat0 = baseMat.clone();
                mat0.side = THREE.BackSide;
                mat0.clippingPlanes = [plane];
                mat0.stencilFail = THREE.IncrementWrapStencilOp;
                mat0.stencilZFail = THREE.IncrementWrapStencilOp;
                mat0.stencilZPass = THREE.IncrementWrapStencilOp;

                var mesh0 = new THREE.Mesh(geometry, mat0);
                mesh0.renderOrder = renderOrder;
                group.add(mesh0);

                // front faces
                var mat1 = baseMat.clone();
                mat1.side = THREE.FrontSide;
                mat1.clippingPlanes = [plane];
                mat1.stencilFail = THREE.DecrementWrapStencilOp;
                mat1.stencilZFail = THREE.DecrementWrapStencilOp;
                mat1.stencilZPass = THREE.DecrementWrapStencilOp;

                var mesh1 = new THREE.Mesh(geometry, mat1);
                mesh1.renderOrder = renderOrder;
                group.add(mesh1);

                return group;
            }

            function loadStlModel()
            {
                const files = getFileList("stl");
                if (files && 1 > files.length)
                {
                    return false;
                }

                var index = 0;
                var loader = new STLLoader(manager);
                for (var cI = 0; cI < files.length; cI++) {
                    loader.load(files[cI], function (geometry) {
                        var tempGeometry = geometry.clone();
                        //tempGeometry.computeTangents();
                        tempGeometry.computeVertexNormals();
                        geometry = tempGeometry.clone();

                        const frontmat = new THREE.MeshPhysicalMaterial({
                            color: 0xF2F2F2,
                            metalness: 0.25,
                            roughness: 0.1,
                            opacity: 0.0,
                            transparent: false,
                            transmission: 0.99,
                            clearcoat: 1.0,
                            clearcoatRoughness: 0.25,
                            polygonOffset: true,
                            polygonOffsetFactor: 1, // positive value pushes polygon further away
                            polygonOffsetUnits: 1,
                            shadowSide: THREE.DoubleSide,
                        });

                        const backmat = new THREE.MeshLambertMaterial({
                            color: 0x000000,
                            side: THREE.BackSide,
                        });

                        const edgeMat = new THREE.LineBasicMaterial({
                            color: 0x000000,
                            side: THREE.FrontSide,
                        });

                        // add the front color
                        var clippedColorFront = new THREE.Mesh(geometry, frontmat);
                        clippedColorFront.name = "frontMesh";
                        clippedColorFront.castShadow = true;
                        clippedColorFront.renderOrder = 6 + index;
                        object.add(clippedColorFront);

                        // add edge
                        const thresholdAngle = 11;
                        const edge = new THREE.EdgesGeometry(geometry, thresholdAngle);
                        const line = new THREE.LineSegments(edge, edgeMat);
                        line.name = "edge";
                        clippedColorFront.add(line);

                        // add the back color
                        var clippedColorBack = new THREE.Mesh(geometry, backmat);
                        clippedColorBack.name = "backMesh";
                        clippedColorFront.add(clippedColorBack);

                        backmat.onBeforeCompile = (shader) => {
                            const token = '#include <begin_vertex>'
                            const customTransform = `vec3 transformed = position + objectNormal*0.05;`
                            shader.vertexShader = shader.vertexShader.replace(token, customTransform)
                        }

                        index++;
                    });
                }

                return true;
            }

            manager.onStart = function (url, itemsLoaded, itemsTotal)
            {
                console.log('Started loading file: ' + url + '.\nLoaded ' + itemsLoaded + ' of ' + itemsTotal + ' files.');
                //在時刻を示すDate.nowを代入
                startTime = performance.now();
            };

            manager.onLoad = function ()
            {
                console.log('Loading complete!');
                endTime = performance.now();
                const elapsed = (endTime - startTime);
                const elapsedStr = elapsed.toFixed(3);
                window.confirm('実行時間 = ' + elapsedStr + 'ミリ秒');
            };

            function readTextFile(file): string
            {
                var allText: string;
                var rawFile = new XMLHttpRequest(); // XMLHttpRequest (often abbreviated as XHR) is a browser object accessible in JavaScript that provides data in XML, JSON, but also HTML format, or even a simple text using HTTP requests.
                rawFile.open("GET", file, false); // open with method GET the file with the link file ,  false (synchronous)
                rawFile.onreadystatechange = function () {
                    if (rawFile.readyState === 4) // readyState = 4: request finished and response is ready
                    {
                        if (rawFile.status === 200) // status 200: "OK"
                        {
                            allText = rawFile.responseText; //  Returns the response data as a string
                            console.log(allText); // display text on the console
                        }
                    }
                }
                rawFile.send(null); //Sends the request to the server Used for GET requests with param null
                return allText;
            }

            function getFileList(dirPath: string): string[]
            {
                let dirList: string[] = new Array();

                var text = readTextFile(dirPath + "/stl.txt");
                var texts = text.split(/\n/);
                for (var cI = 0; cI < texts.length; cI++) {
                    dirList.push(dirPath + '/' + texts[cI]);
                }

                return dirList;
            }

            /**
             * 地面描画 
             */
            function drawGround() {
                //const gridHelper = new THREE.GridHelper(1000.0, 50.0);
                //scene.add(gridHelper);
                const axesHelper = new THREE.AxesHelper(500.0);
                scene.add(axesHelper);
            }

            function onWindowResize() {
                camera.aspect = window.innerWidth / window.innerHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(window.innerWidth, window.innerHeight);
            }

            // 毎フレーム時に実行されるループイベントです
            function render()
            {
                requestAnimationFrame(render);

                if (planeObjects && planeObjects.length > 0) {
                    var plane = planes[0];
                    for (var i = 0; i < planeObjects.length; i++) {
                        var po = planeObjects[i];
                        plane.coplanarPoint(po.position);
                        po.lookAt(
                            po.position.x - plane.normal.x,
                            po.position.y - plane.normal.y,
                            po.position.z - plane.normal.z,
                        );
                    }
                }

                // カメラ更新
                orbitControls.update();

                //requestAnimationFrame(render);

                if (bAnimation)
                {
                    var vec = new THREE.Vector3(0, 0, 1);
                    var viewMatrix = camera.matrixWorldInverse;
                    var axis = vec.applyMatrix4(viewMatrix);
                    axis = axis.normalize();

                    // ミリ秒から秒に変換
                    const sec = performance.now() / 1000;

                    var children = object.children;
                    for (var cI = 0; cI < children.length; cI++) {
                        var mesh = children[cI];

                        // 1秒で45°回転する
                        //mesh.rotation.x = sec * (Math.PI / 4);
                        mesh.rotation.y = sec * (Math.PI / 4);
                        //mesh.rotation.z = sec * (Math.PI / 4);

                        //mesh.rotateOnAxis(axis, sec * (Math.PI / 4));
                        //mesh.rotateOnAxis(axis, 0.05);

                        children[cI] = mesh;
                    }
                }

                // レンダリング
                renderer.render(scene, camera);

                //if (null != effect) {
                //    effect.render(scene, camera);
                //}
            }
        }
    }
}