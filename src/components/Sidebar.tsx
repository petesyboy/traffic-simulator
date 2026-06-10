import React from 'react';

const Sidebar: React.FC = () => {
  const onDragStart = (event: React.DragEvent, nodeType: string, label: string) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify({ type: nodeType, label }));
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className="sidebar">
      <h3>Inputs</h3>
      <div className="draggable-item input" draggable onDragStart={(e) => onDragStart(e, 'inputNode', 'SPAN Port')}>SPAN Port</div>
      <div className="draggable-item input" draggable onDragStart={(e) => onDragStart(e, 'inputNode', 'Network Tap')}>Network Tap</div>
      <div className="draggable-item input" draggable onDragStart={(e) => onDragStart(e, 'inputNode', 'ERSPAN')}>ERSPAN</div>

      <h3>Maps</h3>
      <div className="draggable-item map" draggable onDragStart={(e) => onDragStart(e, 'mapNode', 'Traffic Map')}>Traffic Map</div>

      <h3>Transformations</h3>
      <div className="draggable-item filter" draggable onDragStart={(e) => onDragStart(e, 'filterNode', 'VLAN Filter')}>VLAN Filter</div>
      <div className="draggable-item filter" draggable onDragStart={(e) => onDragStart(e, 'filterNode', 'IP Subnet Filter')}>IP Subnet Filter</div>
      <div className="draggable-item filter" draggable onDragStart={(e) => onDragStart(e, 'filterNode', 'Port Filter')}>Port Filter</div>

      <h3>Tools</h3>
      <div className="draggable-item tool" draggable onDragStart={(e) => onDragStart(e, 'toolNode', 'Forescout')}>Forescout</div>
      <div className="draggable-item tool" draggable onDragStart={(e) => onDragStart(e, 'toolNode', 'ExtraHop')}>ExtraHop</div>
      <div className="draggable-item tool" draggable onDragStart={(e) => onDragStart(e, 'toolNode', 'Vectra')}>Vectra</div>
    </aside>
  );
};

export default Sidebar;