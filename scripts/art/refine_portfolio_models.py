"""MCP editing stages for the backed-up Portfolio-models.blend scene.

Run through Blender MCP with runpy.run_path, then call a stage explicitly.
Edits the existing asset design; never opens, overwrites or exports a file itself.
"""
import math
import random

import bpy
from mathutils import Matrix, Vector


def mesh_data(name, vertices, faces, materials):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    for mat in materials:
        mesh.materials.append(mat)
    return mesh


def color_material(name, color, roughness=0.85, source=None):
    mat = source.copy() if source else bpy.data.materials.new(name)
    mat.name = name
    mat.use_nodes = True
    mat.diffuse_color = (*color, 1)
    shader = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = roughness
    return mat


def keep_parent(obj, parent):
    bpy.context.view_layer.update()
    matrix = obj.matrix_world.copy()
    obj.parent = parent
    obj.matrix_world = matrix


def refine_deer():
    assert bpy.data.objects.get('Deer_Rig') is None, 'Deer stage already applied'
    for obj in list(bpy.data.objects):
        if obj.name.startswith(('Preview_Deer', 'Preview_Leg_')):
            bpy.data.objects.remove(obj, do_unlink=True)
    root = bpy.data.objects['DeerRoot']
    for obj in [root, *root.children_recursive]:
        obj.hide_set(False)
        obj.hide_render = False
    # One connected surface from rump through shoulder to neck.
    coat = bpy.data.materials['Deer_Coat_Bright']
    cream = bpy.data.materials['Deer_Cream']
    rings = [(1.03,1.40,.13,.20),(.81,1.43,.32,.37),(.49,1.43,.395,.40),
             (.12,1.43,.365,.365),(-.25,1.47,.37,.40),(-.58,1.52,.35,.44),
             (-.81,1.72,.275,.36),(-1.03,1.98,.205,.275),
             (-1.24,2.22,.16,.21),(-1.43,2.34,.15,.165)]
    vertices, faces = [], []
    for r,(y,z,rx,rz) in enumerate(rings):
        before = Vector((rings[max(0,r-1)][0],rings[max(0,r-1)][1]))
        after = Vector((rings[min(len(rings)-1,r+1)][0],rings[min(len(rings)-1,r+1)][1]))
        tangent = (after-before).normalized()
        for i in range(12):
            t=i*math.tau/12
            vertices.append((math.sin(t)*rx,y+tangent.y*math.cos(t)*rz,z-tangent.x*math.cos(t)*rz))
    for r in range(len(rings)-1):
        for i in range(12):
            j=(i+1)%12
            faces.append((r*12+i,(r+1)*12+i,(r+1)*12+j,r*12+j))
    faces += [tuple(reversed(range(12))),tuple((len(rings)-1)*12+i for i in range(12))]
    body=bpy.data.objects['DeerBody']
    body.data=mesh_data('Deer_ContinuousSilhouette',vertices,faces,[coat,cream])
    uv=body.data.uv_layers.new(name='CoatUV')
    for p in body.data.polygons:
        if p.index<108:
            r,i=divmod(p.index,12)
            if r<5 and i in (5,6): p.material_index=1
        for li in p.loop_indices:
            r,i=divmod(body.data.loops[li].vertex_index,12)
            u=i/12
            if p.index<108 and p.index%12==11 and i==0: u=1
            uv.data[li].uv=(u,r/9)
    bpy.data.objects.remove(bpy.data.objects['DeerNeck'],do_unlink=True)
    # Smaller dark eyes, warm inset ears, less blocky knees and hooves.
    for matname,col,rough in [('Deer_Eyes',(.008,.006,.004),.22),
                             ('Deer_InnerEar',(.27,.115,.062),.95),
                             ('Deer_Hooves_Nose',(.042,.030,.021),.7),
                             ('Deer_Cream',(.54,.43,.29),.96)]:
        mat=bpy.data.materials[matname]
        mat.diffuse_color=(*col,1)
        node=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
        node.inputs['Base Color'].default_value=(*col,1)
        node.inputs['Roughness'].default_value=rough
    for obj in root.children_recursive:
        if obj.name.startswith('DeerEye_'): obj.scale*=.82
        if obj.name.startswith('DeerEyePatch_'): obj.scale*=.84
        if '_Knee' in obj.name: obj.scale*=.83
        if '_Hoof_' in obj.name: obj.scale.x*=.9; obj.scale.y*=.9
    for side,label in [(-1,'L'),(1,'R')]:
        obj=bpy.data.objects['DeerEar'+label]
        verts=[(side*.15,-1.44,2.46),(side*.36,-1.47,2.64),
               (side*.66,-1.31,2.78),(side*.49,-1.23,2.59),
               (side*.22,-1.30,2.47),(side*.37,-1.34,2.60),
               (side*.36,-1.455,2.61),(side*.585,-1.32,2.727),
               (side*.46,-1.27,2.585)]
        fs=[(0,1,5),(1,2,5),(2,3,5),(3,4,5),(4,0,5),(0,4,3,2,1),(6,7,8)]
        obj.data=mesh_data(obj.name+'_Refined',verts,fs,[coat,bpy.data.materials['Deer_InnerEar']])
        obj.data.polygons[-1].material_index=1
    tip=color_material('Deer_Antler_Ivory',(.46,.32,.18))
    for obj in root.children_recursive:
        if obj.name.startswith('DeerAntler'):
            obj.data=obj.data.copy()
            for v in obj.data.vertices:
                v.co.x*=.82
                v.co.y*=.82
                if 'Beam' in obj.name and obj.name.endswith('_3') and v.co.z>0:
                    v.co.x*=.18;v.co.y*=.18
            if 'Tine' in obj.name or obj.name.endswith('_3'):
                obj.data.materials.clear();obj.data.materials.append(tip)
    # Flatten old empty pivots before skinning; keep all mesh world transforms.
    for obj in list(root.children_recursive):
        if obj.type=='MESH': keep_parent(obj,root)
    for obj in list(root.children_recursive):
        if obj.type=='EMPTY': bpy.data.objects.remove(obj,do_unlink=True)
    polish_deer()
    root['design_style']='Refined adult red deer; continuous torso and neck, tapered antlers, articulated walk rig'
    print('Deer appearance refined:',len(root.children_recursive),'meshes')


def leg_points(side,front):
    x=side*.285;y=-.63 if front else .67;z=1.46 if front else 1.44
    if front:
        return [Vector(p) for p in [(x,y,z),(x*1.03,y-.08,.69),(x*1.1,y-.03,.28),(x*1.13,y-.06,.14)]]
    return [Vector(p) for p in [(x,y,z),(x*1.10,y-.24,.76),(x*1.15,y+.11,.42),(x*1.2,y+.01,.14)]]


def polish_deer():
    mat=bpy.data.materials['Deer_Leg_Brown']
    shader=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    shader.inputs['Base Color'].default_value=(.12,.055,.024,1)
    mat.diffuse_color=(.12,.055,.024,1)
    for side in [-1,1]:
        # Seat the eye in the skull instead of leaving a protruding circular rim.
        bpy.data.objects['DeerEye_'+str(side)].location.x=side*.178
        bpy.data.objects['DeerEyePatch_'+str(side)].location.x=side*.165
    for side,label in [(-1,'Left'),(1,'Right')]:
        for front,place in [(True,'Front'),(False,'Back')]:
            obj=bpy.data.objects['Leg_'+place+label+'_Part0']
            start,end=leg_points(side,front)[:2]
            direction=end-start;q=direction.to_track_quat('Z','Y')
            inv=obj.matrix_local.inverted();vs=[];fs=[]
            for t,r in [(0,.068 if front else .078),(.27,.145 if front else .19),(1,.09 if front else .11)]:
                center=start.lerp(end,t)
                for i in range(12):
                    a=i*math.tau/12
                    vs.append(inv@(center+q@Vector((r*math.cos(a),r*math.sin(a),0))))
            for j in range(2):
                for i in range(12):fs.append((j*12+i,j*12+(i+1)%12,(j+1)*12+(i+1)%12,(j+1)*12+i))
            fs.extend([tuple(reversed(range(12))),tuple(24+i for i in range(12))])
            obj.data=mesh_data(obj.name+'_InsetMuscle',vs,fs,[bpy.data.materials['Deer_Coat_Bright']])
            uv=obj.data.uv_layers.new(name='FurUV')
            for p in obj.data.polygons:
                for li in p.loop_indices:
                    ring,i=divmod(obj.data.loops[li].vertex_index,12)
                    uv.data[li].uv=(i/12,ring/2)


def create_rig():
    root=bpy.data.objects['DeerRoot']
    collection=root.users_collection[0]
    arm=bpy.data.armatures.new('Deer_Skeleton')
    rig=bpy.data.objects.new('Deer_Rig',arm);collection.objects.link(rig);rig.parent=root
    bpy.context.view_layer.objects.active=rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    def bone(name,head,tail,parent=None):
        b=arm.edit_bones.new(name);b.head=head;b.tail=tail
        if parent: b.parent=arm.edit_bones[parent]
    bone('Body',(0,.55,1.4),(0,-.65,1.5))
    bone('Neck',(0,-.65,1.5),(0,-1.42,2.27),'Body')
    bone('Head',(0,-1.42,2.27),(0,-1.94,2.15),'Neck')
    bone('Tail',(0,.94,1.55),(0,1.22,1.67),'Body')
    for side,label in [(-1,'Left'),(1,'Right')]:
        for front,place in [(True,'Front'),(False,'Back')]:
            name='Leg_'+place+label;points=leg_points(side,front)
            for i in range(3):bone(name+'_'+str(i),points[i],points[i+1],'Body' if i==0 else name+'_'+str(i-1))
            bone(name+'_Foot',points[-1],points[-1]+Vector((0,-.16,0)),name+'_2')
    bpy.ops.object.mode_set(mode='OBJECT')
    for obj in [o for o in root.children_recursive if o.type=='MESH']:
        mod=obj.modifiers.new('Deer skin','ARMATURE');mod.object=rig
        def weight(b,indices,w=1):
            group=obj.vertex_groups.get(b) or obj.vertex_groups.new(name=b)
            group.add(indices,w,'REPLACE')
        if obj.name=='DeerBody':
            for v in obj.data.vertices:
                r=v.index//12;nw=[0,0,0,0,0,.05,.4,.85,1,1][r]
                if nw<1:weight('Body',[v.index],1-nw)
                if nw>0:weight('Neck',[v.index],nw)
        else:
            b='Head'
            if obj.name=='DeerTail':b='Tail'
            elif obj.name.startswith('Leg_'):
                name='_'.join(obj.name.split('_')[:2])
                b=name+('_Foot' if '_Hoof_' in obj.name else '_0' if '_Knee' in obj.name else '_'+obj.name[-1])
            weight(b,list(range(len(obj.data.vertices))))
    for p in rig.pose.bones:p.rotation_mode='QUATERNION'
    rig['animation_help']='Deer_Walk_Relaxed: frames 1-49, 24 fps. Deer_Walk_Brisk: frames 1-33. Both loop in place; forward is local -Y.'
    root.location=(7.8,0,0)
    print('Rig:',len(arm.bones),'bones')


def solve_knee(a,b,l1,l2,forward):
    direction=b-a;d=direction.length;axis=direction.normalized()
    assert d<l1+l2, 'Unreachable gait target'
    along=(l1*l1-l2*l2+d*d)/(2*d)
    height=math.sqrt(max(0,l1*l1-along*along))
    pole=Vector((0,-1 if forward else 1,0));pole=(pole-axis*pole.dot(axis)).normalized()
    return a+axis*along+pole*height


def animate_deer():
    rig=bpy.data.objects['Deer_Rig'];scene=bpy.context.scene
    scene.render.fps=24
    rig.animation_data_create()
    for action_name,period,stride,lift,drop in [('Deer_Walk_Relaxed',48,.48,.12,.065),('Deer_Walk_Brisk',32,.64,.17,.105)]:
        action=bpy.data.actions.new(action_name);action.use_fake_user=True
        rig.animation_data.action=action
        for frame in range(1,period+2):
            phase=(frame-1)/period;theta=math.tau*phase
            for p in rig.pose.bones:p.matrix_basis=Matrix.Identity(4)
            bob=-drop+.008*math.cos(theta*4)
            rig.pose.bones['Body'].location=(0,0,0)
            mat=rig.data.bones['Body'].matrix_local.copy();mat.translation+=Vector((0,0,bob))
            rig.pose.bones['Body'].matrix=mat
            bpy.context.view_layer.update()
            rig.pose.bones['Neck'].rotation_quaternion=Vector((1,0,0)).rotation_difference(Vector((1,0,0)))
            from mathutils import Quaternion
            rig.pose.bones['Neck'].rotation_quaternion=Quaternion((1,0,0),.012*math.sin(theta*2))
            rig.pose.bones['Head'].rotation_quaternion=Quaternion((1,0,0),-.018*math.sin(theta*2+.2))
            rig.pose.bones['Tail'].rotation_quaternion=Quaternion((0,1,0),.08*math.sin(theta))
            bpy.context.view_layer.update()
            for side,label in [(-1,'Left'),(1,'Right')]:
                for front,place in [(True,'Front'),(False,'Back')]:
                    name='Leg_'+place+label;rest=leg_points(side,front)
                    offset=(.25 if front else 0)+(.5 if side>0 else 0)
                    t=(phase+offset)%1;stance=.66
                    if t<stance:y=-stride/2+stride*t/stance;z=0
                    else:
                        u=(t-stance)/(1-stance)
                        y=stride/2-stride*(u*u*(3-2*u));z=lift*math.sin(math.pi*u)**2
                    foot=rest[3]+Vector((0,y,z))
                    ankle=foot+(rest[2]-rest[3])
                    hip=rest[0]+Vector((0,0,bob))
                    knee=solve_knee(hip,ankle,(rest[1]-rest[0]).length,(rest[2]-rest[1]).length,not front)
                    points=[hip,knee,ankle,foot,foot+Vector((0,-.16,0))]
                    for i,suffix in enumerate(['_0','_1','_2','_Foot']):
                        b=rig.data.bones[name+suffix]
                        delta=(b.tail_local-b.head_local).rotation_difference(points[i+1]-points[i])
                        mat=delta.to_matrix().to_4x4()@b.matrix_local.to_3x3().to_4x4();mat.translation=points[i]
                        rig.pose.bones[b.name].matrix=mat
                        bpy.context.view_layer.update()
            for p in rig.pose.bones:
                p.keyframe_insert('location',frame=frame,group=p.name)
                p.keyframe_insert('rotation_quaternion',frame=frame,group=p.name)
        for layer in action.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    for fc in bag.fcurves:
                        for kp in fc.keyframe_points:kp.interpolation='LINEAR'
                        fc.modifiers.new('CYCLES')
        action['stride_m']=stride;action['period_frames']=period;action['forward_axis']='-Y'
    rig.animation_data.action=bpy.data.actions['Deer_Walk_Relaxed']
    scene.frame_start=1;scene.frame_end=49;scene.frame_set(1)
    print('Walk actions complete:',[(a.name,list(a.frame_range)) for a in bpy.data.actions])


def canopy_parts(source):
    mesh=source.data
    adjacency={v.index:set() for v in mesh.vertices}
    for edge in mesh.edges:
        a,b=edge.vertices;adjacency[a].add(b);adjacency[b].add(a)
    unseen=set(adjacency);parts=[]
    while unseen:
        stack=[unseen.pop()];indices=[]
        while stack:
            i=stack.pop();indices.append(i)
            for j in adjacency[i]&unseen:unseen.remove(j);stack.append(j)
        inds=set(indices);mapping={v:i for i,v in enumerate(indices)}
        center=sum((mesh.vertices[i].co for i in indices),Vector())/len(indices)
        vertices=[mesh.vertices[i].co-center for i in indices]
        radius=Vector([max(abs(v[k]) for v in vertices) for k in range(3)])
        vertices=[Vector([v[k]/radius[k] for k in range(3)]) for v in vertices]
        faces=[];uvs=[]
        for polygon in mesh.polygons:
            if polygon.vertices[0] in inds:
                faces.append(tuple(mapping[i] for i in polygon.vertices))
                uvs.append([tuple(mesh.uv_layers.active.data[i].uv) for i in polygon.loop_indices])
        parts.append((vertices,faces,uvs))
    return parts


def make_tree(name,position,source,bark,branches,seed):
    rng=random.Random(seed)
    collection=bpy.data.collections.get('Forest_Variants')
    if not collection:
        collection=bpy.data.collections.new('Forest_Variants');bpy.context.scene.collection.children.link(collection)
    root=bpy.data.objects.new(name,None);collection.objects.link(root);root.location=position
    root['design']='Existing irregular polygon foliage, redistributed over individually shaped forks and branch tips'
    vs=[];fs=[];uvs=[]
    def tube(points,radii):
        start=len(vs)
        for i,p in enumerate(points):
            p=Vector(p);a=Vector(points[max(0,i-1)]);b=Vector(points[min(len(points)-1,i+1)])
            q=(b-a).to_track_quat('Z','Y')
            for j in range(8):
                t=math.tau*j/8
                vs.append(p+q@Vector((math.cos(t)*radii[i],math.sin(t)*radii[i],0)))
        for i in range(len(points)-1):
            for j in range(8):
                fs.append((start+i*8+j,start+i*8+(j+1)%8,start+(i+1)*8+(j+1)%8,start+(i+1)*8+j))
                v0=Vector(points[i]).z*.24;v1=Vector(points[i+1]).z*.24
                uvs.append([(j/8,v0),((j+1)/8,v0),((j+1)/8,v1),(j/8,v1)])
        fs.append(tuple(start+i for i in reversed(range(8))));uvs.append([(0,0)]*8)
        fs.append(tuple(start+(len(points)-1)*8+i for i in range(8)));uvs.append([(0,1)]*8)
    leaves=[]
    for bi,(points,radii,size) in enumerate(branches):
        tube(points,radii)
        if not size:continue
        tip=Vector(points[-1]);prev=Vector(points[-2])
        leaves.append((tip+Vector((0,0,.25)),Vector(size)))
        direction=(tip-prev).normalized()
        for sign in [-1,1]:
            angle=rng.uniform(0,math.tau)
            sideways=Vector((math.cos(angle),math.sin(angle),.3))
            start=prev.lerp(tip,.52)
            end=tip+sideways*rng.uniform(.45,.72)+Vector((0,0,rng.uniform(-.18,.24)))
            tube([start,start.lerp(end,.58)+Vector((0,0,.12)),end],[radii[-2]*.45,.055,.015])
            leaves.append((end+Vector((0,0,.20)),Vector(size)*rng.uniform(.63,.82)))
    # Modest flared root buttresses for a grounded base.
    base=Vector(branches[0][0][0]);r=branches[0][1][0]
    for i in range(5):
        a=i*math.tau/5+.25
        end=base+Vector((math.cos(a)*r*2.3,math.sin(a)*r*2.3,.025))
        tube([base+Vector((0,0,.55)),base.lerp(end,.6)+Vector((0,0,.13)),end],[r*.56,r*.42,.018])
    trunk=bpy.data.objects.new(name+'_Trunk',mesh_data(name+'_BranchMesh',vs,fs,[bark]))
    collection.objects.link(trunk);trunk.parent=root
    uv=trunk.data.uv_layers.new(name='BarkUV')
    for poly,coords in zip(trunk.data.polygons,uvs):
        for li,co in zip(poly.loop_indices,coords):uv.data[li].uv=co
    parts=canopy_parts(source);vs=[];fs=[];uvs=[]
    from mathutils import Euler
    for center,scale in leaves:
        verts,faces,texcoords=rng.choice(parts)
        rotation=Euler((rng.uniform(-.22,.22),rng.uniform(-.22,.22),rng.uniform(0,math.tau))).to_matrix()
        start=len(vs)
        vs.extend(center+rotation@Vector((v.x*scale.x,v.y*scale.y,v.z*scale.z)) for v in verts)
        fs.extend(tuple(start+i for i in f) for f in faces);uvs.extend(texcoords)
    canopy=bpy.data.objects.new(name+'_Canopy',mesh_data(name+'_PolygonCrown',vs,fs,list(source.data.materials)))
    collection.objects.link(canopy);canopy.parent=root
    uv=canopy.data.uv_layers.new(name='OriginalLeafUV')
    for poly,coords in zip(canopy.data.polygons,uvs):
        for li,co in zip(poly.loop_indices,coords):uv.data[li].uv=co
    root['foliage_lobes']=len(leaves)
    print(name,'lobes',len(leaves),'branch vertices',len(trunk.data.vertices))
    return root


def build_trees():
    assert bpy.data.collections.get('Forest_Variants') is None,'Tree stage already applied'
    oak=bpy.data.objects['OakCanopy'];birch=bpy.data.objects['BirchCanopy']
    ob=bpy.data.materials['Tree_Oak_Bark'];bb=bpy.data.materials['Tree_Birch_Bark']
    # Broad oak: low heavy forks and widely spaced, ascending secondary limbs.
    branches=[([(0,0,0),(.12,.03,1.6),(-.15,.08,2.7),(.15,.18,4.2),(.25,.1,5.4)],[.38,.30,.25,.13,.035],(.95,.85,.83))]
    for start,mid,end in [((.04,.02,1.6),(-1.1,.1,2.8),(-2.25,.25,4.0)),
                          ((-.1,.06,2.4),(1.15,.2,3.3),(2.30,.3,4.30)),
                          ((-.12,.08,2.6),(-.45,-1.25,3.6),(-.55,-2.0,4.55)),
                          ((.05,.15,3.4),(.35,1.1,4.1),(.6,1.8,4.85)),
                          ((-.6,.05,2.5),(-1.3,1,3.4),(-1.6,1.35,4.5)),
                          ((.8,.17,3.1),(1.5,-.85,3.8),(1.7,-1.25,4.55))]:
        branches.append(([start,mid,end],[.21,.12,.025],(.95,.85,.82)))
    make_tree('Oak_Spreading',(-9,8,0),oak,ob,branches,71)
    # Birch: two tall asymmetric leaders, fine upswept branches, tiered foliage.
    branches=[([(0,0,0),(.03,0,2.4),(-.20,.1,4.2),(-.48,.08,6.1),(-.35,.05,7.25)],[.21,.17,.13,.075,.018],(.7,.65,.87)),
              ([(.02,0,2.2),(.6,.08,3.7),(.88,.13,5.4),(.7,.2,6.7)],[.15,.115,.07,.018],(.66,.62,.84))]
    for start,end in [((-.12,.08,3.7),(-1.50,.25,5.05)),((.6,.08,3.7),(1.7,-.25,5.25)),
                      ((-.35,.08,5.3),(-1.15,-.85,6.15)),((.8,.13,5.1),(1.35,.95,6.15)),
                      ((-.45,.08,6.0),(-.8,.9,6.85))]:
        a=Vector(start);b=Vector(end)
        branches.append(([a,a.lerp(b,.6)-Vector((0,0,.25)),b],[.085,.046,.012],(.66,.62,.78)))
    make_tree('Birch_Forked',(-2,8,0),birch,bb,branches,125)
    # Rowan silhouette: compact multi-stem fan with an open middle and softer tiers.
    branches=[([(0,0,0),(-.16,.04,1.1),(-.45,.1,2.7),(-.7,.14,4.4)],[.25,.19,.12,.018],(.8,.78,.72))]
    for start,mid,end in [((-.1,.03,.8),(.55,.05,2.1),(1.25,.2,4.1)),
                          ((-.23,.06,1.6),(-1.05,.1,2.6),(-1.7,.12,3.5)),
                          ((.4,.05,1.9),(.8,-.85,2.8),(1.15,-1.3,3.65)),
                          ((-.3,.08,2.2),(-.35,1.05,3.1),(-.3,1.55,4.0)),
                          ((-.4,.08,2.5),(-1.05,-.65,3.35),(-1.3,-.95,4.05))]:
        branches.append(([start,mid,end],[.14,.082,.018],(.8,.7,.67)))
    make_tree('Rowan_Fan',(4.5,8,0),birch,ob,branches,217)
    # Wind-shaped oak: leaning trunk and long lateral, unevenly split branches.
    branches=[([(0,0,0),(.35,.08,1.4),(.85,.10,2.6),(1.45,.1,3.65),(2.1,.18,4.5)],[.32,.27,.2,.11,.025],(.98,.8,.7))]
    for start,mid,end in [((.5,.08,1.8),(-.35,.1,2.5),(-1.1,.15,3.25)),
                          ((.8,.10,2.5),(1.6,-.65,3.1),(2.6,-.9,3.65)),
                          ((1.2,.1,3.2),(2.3,.65,3.75),(3.0,.95,4.20)),
                          ((.5,.08,1.9),(1.05,1.0,2.9),(1.35,1.4,3.8)),
                          ((1.35,.1,3.5),(.5,-.7,3.7),(.25,-1.1,4.25))]:
        branches.append(([start,mid,end],[.15,.09,.02],(.95,.78,.70)))
    make_tree('Oak_Windswept',(11,8,0),oak,ob,branches,329)
    print('Four distinct tree variants completed')


def review_setup():
    collection=bpy.data.collections.new('Asset_Review')
    bpy.context.scene.collection.children.link(collection)
    floor_mat=color_material('Review_Matte_Stone',(.115,.135,.13),.98)
    mesh=mesh_data('Review_Floor',[(-60,-60,-.015),(60,-60,-.015),(60,60,-.015),(-60,60,-.015)],[(0,1,2,3)],[floor_mat])
    floor=bpy.data.objects.new('Review_Floor',mesh);collection.objects.link(floor)
    for name,pos,target,scale in [('Review_Deer_Camera',(12.7,-7.8,3.9),(7.8,-.3,1.65),5.3),
                                   ('Review_Trees_Camera',(2,-26,14),(2,8,3.7),31)]:
        data=bpy.data.cameras.new(name);data.type='ORTHO';data.ortho_scale=scale
        camera=bpy.data.objects.new(name,data);collection.objects.link(camera);camera.location=pos
        camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler()
    # Keep the two untouched reference trees available, behind the new variants.
    for name in ['Preview_BirchTrunk','Preview_BirchCanopy','Preview_OakTrunk','Preview_OakCanopy']:
        obj=bpy.data.objects.get(name)
        if obj:obj.location.y=23
    readme=bpy.data.texts.new('Portfolio_Models_README')
    readme.write('PORTFOLIO MODELS - refined source\n\n'
                 'Backup: Portfolio-models-v1.blend (saved before all edits).\n'
                 'DeerRoot / Deer_Rig: 20 bones, connected torso/neck and original coat.\n'
                 'Action Deer_Walk_Relaxed: frames 1-49 at 24 fps.\n'
                 'Action Deer_Walk_Brisk: frames 1-33 at 24 fps.\n'
                 'Both are looping in-place walks, forward local -Y. Last frame duplicates first.\n'
                 'Select Deer_Rig in the Action Editor to switch actions.\n'
                 'Forest_Variants: Oak_Spreading, Birch_Forked, Rowan_Fan, Oak_Windswept.\n'
                 'Original irregular foliage topology and leaf UV/materials retained.\n'
                 'Original reference trees remain behind variants at Y=23.\n'
                 'Asset_Review holds only presentation floor and cameras; exclude from exports.\n'
                 'Game GLBs have not been overwritten.\n')
    bpy.context.scene.camera=bpy.data.objects['Review_Deer_Camera']
    bpy.context.scene.render.image_settings.file_format='PNG'
    bpy.context.scene.render.resolution_x=1200
    bpy.context.scene.render.resolution_y=900
    bpy.context.scene.render.resolution_percentage=100


def validate_scene():
    scene=bpy.context.scene;rig=bpy.data.objects['Deer_Rig']
    original_action=rig.animation_data.action;original_frame=scene.frame_current
    result={}
    try:
        for name in ['Deer_Walk_Relaxed','Deer_Walk_Brisk']:
            action=bpy.data.actions[name];rig.animation_data.action=action
            end=int(action.frame_range[1]);scene.frame_set(1)
            first={p.name:p.matrix.copy() for p in rig.pose.bones}
            scene.frame_set(end)
            error=max(abs(p.matrix[i][j]-first[p.name][i][j]) for p in rig.pose.bones for i in range(4) for j in range(4))
            minimum=100;maximum=-100
            hooves=[o for o in bpy.data.objects if o.name.startswith('Leg_') and '_Hoof_' in o.name]
            for sample in range(2,end*2):
                scene.frame_set(sample//2,subframe=.5 if sample%2 else 0)
                dg=bpy.context.evaluated_depsgraph_get()
                for obj in hooves:
                    evaluated=obj.evaluated_get(dg);mesh=evaluated.to_mesh()
                    lowest=min((evaluated.matrix_world@v.co).z for v in mesh.vertices)
                    minimum=min(minimum,lowest);maximum=max(maximum,lowest)
                    evaluated.to_mesh_clear()
            assert error<.00001,(name,'loop discontinuity',error)
            assert minimum>=-.001,(name,'ground penetration',minimum)
            result[name]={'loop_error':error,'minimum_hoof_z':round(minimum,6),'maximum_hoof_lift_z':round(maximum,6),'frames':[1,end]}
        for name in ['Oak_Spreading','Birch_Forked','Rowan_Fan','Oak_Windswept']:
            root=bpy.data.objects[name];canopy=bpy.data.objects[name+'_Canopy'];trunk=bpy.data.objects[name+'_Trunk']
            assert len(root.children)==2 and len(canopy.data.uv_layers)==1
            assert min(v.co.z for v in trunk.data.vertices)<.1
            assert len(canopy.data.polygons)>0
        assert len(rig.data.bones)==20
        result['trees']=4;result['rig_bones']=20
    finally:
        rig.animation_data.action=original_action;scene.frame_set(original_frame)
    print(result)
    return result
