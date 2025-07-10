'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { scheduleService } from '@/services/schedule.service';
import ConfirmationModal from './ConfirmationModal';
import { useSession } from 'next-auth/react';

// Inside your component



const RoomCardSkeleton = () => (
    <div className="h-28 sm:h-32 bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse"></div>
);

const ScheduledClassCard = ({ classData, onDragStart, onDragEnd }) => (
    <div 
        draggable 
        onDragStart={onDragStart} 
        onDragEnd={onDragEnd} 
        className="w-full h-24 p-2 bg-blue-100 dark:bg-blue-800 border border-blue-400 dark:border-blue-600 rounded-lg shadow-md flex flex-col justify-center items-center text-center cursor-grab active:cursor-grabbing transition-all duration-150"
    >
        <p className="text-xs font-semibold text-blue-800 dark:text-blue-100 break-words">{classData.className}</p>
        <p className="text-xs text-blue-600 dark:text-blue-300 opacity-80">{classData.majorName}</p>
    </div>
);

const RoomCard = React.memo(({ room, classData, isDragOver, isWarning, dragHandlers, className }) => {
    const router = useRouter();
    const isOccupied = !!classData;
    const isUnavailable = room.status === "unavailable";

    const getBorderColor = () => {
        if (isWarning) return 'border-red-500 dark:border-red-400 shadow-lg scale-105';
        if (isDragOver) return 'border-emerald-400 dark:border-emerald-500 shadow-lg scale-105';
        return 'border-gray-300 dark:border-gray-700 shadow-sm';
    };

    const handleHeaderClick = () => {
        router.push(`/admin/schedule/${room.roomId}`);
    };

    return (
        <div
            className={`rounded-lg border flex flex-col transition-all duration-150 overflow-hidden ${getBorderColor()}
            ${isUnavailable ? 'cursor-not-allowed bg-slate-50 dark:bg-slate-800/50 opacity-70' : ''}
            ${className || ''}
            `}
        >
            <div
                onClick={handleHeaderClick}
                className={`px-2 py-1 flex justify-between items-center border-b-2 transition-colors cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700
                ${isWarning ? 'bg-red-100 dark:bg-red-800/50' : (isUnavailable ? 'bg-slate-100 dark:bg-slate-700/60' : 'bg-gray-50 dark:bg-gray-800')}
                `}
            >
                <div className={`w-2 h-2 rounded-full ring-1 ring-white/50
                    ${isOccupied ? 'bg-red-500' : isUnavailable ? 'bg-red-500' : 'bg-green-500'}
                    `}
                    title={isOccupied ? 'Occupied' : 'Available'}
                ></div>
                <span className={`text-xs font-bold ${isUnavailable ? 'text-slate-500 dark:text-slate-400' : 'text-gray-700 dark:text-gray-300'}`}>{room.roomName}</span>
            </div>
            <div
                onDragOver={!isUnavailable ? dragHandlers.onDragOver : null}
                onDragEnter={!isUnavailable ? dragHandlers.onDragEnter : null}
                onDragLeave={!isUnavailable ? dragHandlers.onDragLeave : null}
                onDrop={!isUnavailable ? dragHandlers.onDrop : null}
                className={`flex-grow p-2 flex justify-center items-center text-center transition-colors min-h-[112px]
                ${isDragOver ? 'bg-emerald-100 dark:bg-emerald-800/50' : (isUnavailable ? 'bg-slate-50 dark:bg-slate-800/50' : 'bg-white dark:bg-gray-900')}
                `}
            >
                {isOccupied ? (
                    <ScheduledClassCard 
                        classData={classData} 
                        onDragStart={dragHandlers.onDragStart} 
                        onDragEnd={dragHandlers.onDragEnd} 
                    />
                ) : (
                    <span className={`text-xs italic select-none pointer-events-none ${isUnavailable ? 'text-red-600 dark:text-red-400' : 'text-gray-400 dark:text-gray-600'}`}>
                        {isUnavailable ? 'Unavailable' : `${room.roomName}`}
                    </span>
                )}
            </div>
        </div>
    );
});

RoomCard.displayName = 'RoomCard';

const ScheduleClientView = ({ 
    initialClasses, 
    initialRooms, 
    initialSchedules, 
    buildingLayout, 
    constants 
}) => {
    const { data: session } = useSession();
    const token = session?.accessToken; // or session?.token depending on your setup
    const { degrees, generations, buildings, weekdays, timeSlots } = constants;

    const [schedules, setSchedules] = useState(initialSchedules);
    const [isAssigning, setIsAssigning] = useState(false);
    const [selectedDay, setSelectedDay] = useState(weekdays[0]);
    const [selectedTime, setSelectedTime] = useState(timeSlots[0]);
    const [selectedBuilding, setSelectedBuilding] = useState(buildings[0]);
    const [draggedItem, setDraggedItem] = useState(null);
    const [dragOverCell, setDragOverCell] = useState(null);
    const [warningCellId, setWarningCellId] = useState(null);
    const [toastMessage, setToastMessage] = useState('');
    const [selectedDegree, setSelectedDegree] = useState('All');
    const [selectedGeneration, setSelectedGeneration] = useState('All');
    const [searchTerm, setSearchTerm] = useState('');
    const [swapConfirmation, setSwapConfirmation] = useState({ 
        isOpen: false, 
        details: null 
    });

    const generationColorMap = {
        '29': 'bg-sky-500',
        '30': 'bg-emerald-500',
        '31': 'bg-amber-500',
        '32': 'bg-indigo-500',
        '33': 'bg-violet-500',
    };
    const dayApiToAbbrMap = {
        MONDAY: 'Mo',
        TUESDAY: 'Tu', 
        WEDNESDAY: 'We',
        THURSDAY: 'Th',
        FRIDAY: 'Fr',
        SATURDAY: 'Sa',
        SUNDAY: 'Su'
    };

    const shiftNameMap = {
        '07:00:00': 'Morning Shift',
        '10:30:00': 'Noon Shift',
        '14:00:00': 'Afternoon Shift',
        '17:30:00': 'Evening Shift',
        '07:30:00': 'Weekend Shift'
    };
    
    // Reverse mapping
    const dayAbbrToApiMap = {
        Mo: 'MONDAY',
        Tu: 'TUESDAY',
        We: 'WEDNESDAY',
        Th: 'THURSDAY',
        Fr: 'FRIDAY',
        Sa: 'SATURDAY',
        Su: 'SUNDAY'
    };
    
    const showToast = (message) => {
        setToastMessage(message);
        setTimeout(() => setToastMessage(''), 1500);
    };

    const allFilteredClasses = useMemo(() => {
        const assignedClassIds = new Set();
        const selectedDayFull = Object.entries(dayApiToAbbrMap)
            .find(([_, abbr]) => abbr === selectedDay)?.[0] || '';
        
        // Get all assigned class IDs
        Object.values(schedules).forEach(daySchedule => {
            Object.values(daySchedule).forEach(timeSchedule => {
                Object.values(timeSchedule).forEach(scheduleInfo => {
                    if (scheduleInfo?.classId) assignedClassIds.add(scheduleInfo.classId);
                });
            });
        });

        return initialClasses.filter(classItem => {
            // Check if class occurs on selected day
            const occursOnSelectedDay = classItem.dayDetails?.some(
                day => day.dayOfWeek === selectedDayFull && !day.online
            );
            
            // Check if class matches selected shift
            const shiftMatch = selectedTime === 'All' || 
                classItem.shift?.name === selectedTime ||
                (selectedTime === 'Weekend Shift' && ['Sa', 'Su'].includes(selectedDay));
            
            // Show in list if:
            // 1. Occurs on selected day
            // 2. Matches selected shift (or 'All' is selected)
            // 3. Is either unassigned or not assigned to any room
            const shouldShow = occursOnSelectedDay && shiftMatch && (
                !assignedClassIds.has(classItem.classId) || 
                classItem.roomName === "Unassigned"
            );
            
            const degreeMatch = selectedDegree === 'All' || classItem.degreeName === selectedDegree;
            const generationMatch = selectedGeneration === 'All' || classItem.generation === selectedGeneration;
            const searchTermMatch = searchTerm === '' || 
                classItem.className.toLowerCase().includes(searchTerm.toLowerCase()) || 
                (classItem.majorName && classItem.majorName.toLowerCase().includes(searchTerm.toLowerCase()));

            return shouldShow && degreeMatch && generationMatch && searchTermMatch;
        });
    }, [schedules, selectedDay, selectedTime, selectedDegree, selectedGeneration, searchTerm, initialClasses]);

    const groupedClassesByShift = useMemo(() => {
        if (selectedTime !== 'All') {
            // If a specific shift is selected, just show all filtered classes in one group
            return { [selectedTime]: allFilteredClasses };
        }
        
        // If 'All' is selected, group by shift
        const groups = {};
        constants.timeSlots.forEach(slot => {
            groups[slot] = allFilteredClasses.filter(classItem => 
                classItem.shift?.name === slot ||
                (slot === 'Weekend Shift' && ['Sa', 'Su'].includes(selectedDay))
            );
        });
        return groups;
    }, [allFilteredClasses, selectedTime, selectedDay, constants.timeSlots]);

    const getClassForRoom = (roomId) => {
        const scheduleInfo = schedules[selectedDay]?.[selectedTime]?.[roomId];
        if (!scheduleInfo) return null;
        
        // Find in combined classes
        return initialClasses.find(c => c.classId === scheduleInfo.classId) || {
            ...scheduleInfo,
            generation: scheduleInfo.year // Map year to generation if needed
        };
    };
    

    const orderedTimeSlots = useMemo(() => {
        if (selectedTime === 'All') {
            return timeSlots;
        }
        const otherTimes = timeSlots.filter(slot => slot !== selectedTime);
        return [selectedTime, ...otherTimes];
    }, [selectedTime, timeSlots]);

    const currentGrid = useMemo(() => {
        return buildingLayout[selectedBuilding] ?? {};
    }, [buildingLayout, selectedBuilding]);
    
    const { availableRoomsCount, unavailableRoomsCount } = useMemo(() => {
        if (!selectedBuilding || !buildingLayout[selectedBuilding]) {
            return { availableRoomsCount: 0, unavailableRoomsCount: 0 };
        }

        const roomsInBuilding = Object.values(buildingLayout[selectedBuilding]).flat();
        const totalRoomsInBuilding = roomsInBuilding.length;

        const timeSchedule = schedules[selectedDay]?.[selectedTime] || {};

        const unavailableRoomIds = new Set();

        roomsInBuilding.forEach(room => {
            if (timeSchedule[room.roomId]) {
                unavailableRoomIds.add(room.roomId);
            }
            if (room.status === 'unavailable') {
                unavailableRoomIds.add(room.roomId);
            }
        });
        
        return {
            availableRoomsCount: totalRoomsInBuilding - unavailableRoomIds.size,
            unavailableRoomsCount: unavailableRoomIds.size,
        };
    }, [selectedBuilding, selectedDay, selectedTime, schedules, buildingLayout]);

    const handleDragStartFromList = (event, classData) => {
        setDraggedItem({ item: classData, type: 'new' });
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('application/json', JSON.stringify(classData));
    };
    
    const handleDragStartFromGrid = (event, classData, roomId) => {
        const scheduleInfo = schedules[selectedDay]?.[selectedTime]?.[roomId];
        if (!scheduleInfo) return;
    
        setDraggedItem({ 
            item: classData, 
            type: 'scheduled', 
            origin: { 
                day: selectedDay, 
                time: selectedTime, 
                roomId: roomId, 
                scheduleId: scheduleInfo.scheduleId 
            }
        });
        event.dataTransfer.effectAllowed = 'move';
    };

    const handleDragEnd = async (event) => {
        if (!draggedItem) {
            setDraggedItem(null);
            setDragOverCell(null);
            setWarningCellId(null);
            return;
        }
    
        // Check if the item was dragged out (not dropped on a valid target)
        if (draggedItem.type === 'scheduled' && event.dataTransfer.dropEffect === 'none') {
            const { origin } = draggedItem;
            
            try {
                setIsAssigning(true);
                await scheduleService.unassignRoomFromClass(origin.scheduleId, session.accessToken);
                
                // Update UI state upon successful deletion
                setSchedules(prevSchedules => {
                    const newSchedules = JSON.parse(JSON.stringify(prevSchedules));
                    if (newSchedules[origin.day]?.[origin.time]?.[origin.roomId]) {
                        delete newSchedules[origin.day][origin.time][origin.roomId];
                        
                        // Clean up empty objects
                        if (Object.keys(newSchedules[origin.day][origin.time]).length === 0) {
                            delete newSchedules[origin.day][origin.time];
                        }
                        if (Object.keys(newSchedules[origin.day]).length === 0) {
                            delete newSchedules[origin.day];
                        }
                    }
                    return newSchedules;
                });
                
                showToast("Class unassigned successfully.");
            } catch (error) {
                console.error("Failed to unassign class:", error);
                showToast(`Failed to unassign class: ${error.message}`, true);
            } finally {
                setIsAssigning(false);
            }
        }
    
        setDraggedItem(null);
        setDragOverCell(null);
        setWarningCellId(null);
    };

    const handleGridCellDragOver = (event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    };

    const handleGridCellDragEnter = (event, roomId) => {
        event.preventDefault();
        const room = initialRooms.find(r => r.roomId === roomId);
        if (room.status === "unavailable") {
            setWarningCellId(roomId);
        } else {
            setDragOverCell({ roomId });
            if (draggedItem?.type === 'new' && schedules[selectedDay]?.[selectedTime]?.[roomId]) {
                setWarningCellId(roomId);
            }
        }
    };

    const handleGridCellDragLeave = (event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
            setDragOverCell(null);
            setWarningCellId(null);
        }
    };

    const handleGridCellDrop = async (event, targetRoomId) => {
        event.preventDefault();
        setDragOverCell(null);
        setWarningCellId(null);

        if (!draggedItem || draggedItem.type !== 'new') {
            // Logic for moving/swapping existing items would go here
            return;
        }

        const classData = draggedItem.item;
        const shiftId = classData.shift?.shiftId;
        
        // Convert abbreviated day to full uppercase name for the backend
        const dayOfWeekMap = { Mo: 'MONDAY', Tu: 'TUESDAY', We: 'WEDNESDAY', Th: 'THURSDAY', Fr: 'FRIDAY', Sa: 'SATURDAY', Su: 'SUNDAY' };
        const dayOfWeekForAPI = dayOfWeekMap[selectedDay];

        if (!shiftId || !dayOfWeekForAPI) {
            showToast("Cannot schedule: Class is missing shift or day information.", true);
            return;
        }

        const scheduleRequestPayload = {
            classId: classData.classId,
            roomId: targetRoomId,
            dayOfWeek: dayOfWeekForAPI,
            shiftId: shiftId,
            isOnline: false, // Defaulting to false for room assignment
        };

        try {
            const response = await scheduleService.assignRoomToClass(scheduleRequestPayload, session.accessToken);
            
            // Optimistically update the UI state
            setSchedules(previousSchedules => {
                const newSchedules = JSON.parse(JSON.stringify(previousSchedules));
                if (!newSchedules[selectedDay]) newSchedules[selectedDay] = {};
                if (!newSchedules[selectedDay][selectedTime]) newSchedules[selectedDay][selectedTime] = {};
                newSchedules[selectedDay][selectedTime][targetRoomId] = classData.classId;
                return newSchedules;
            });

            showToast(response.message || "Class scheduled successfully!");

        } catch (error) {
            showToast(error.message || "Failed to schedule class.", true);
        } finally {
            setDraggedItem(null);
        }
    };

    const handleConfirmSwap = async () => {
        setIsAssigning(true);
        try {
            const { from, to } = swapConfirmation.details;
            const session = await getServerSession();
            const token = session?.accessToken;

            if (!token) {
                showToast("Authentication required");
                return;
            }

            await scheduleService.assignClassToRoom(from.classId, to.roomId, token);
            await scheduleService.assignClassToRoom(to.classId, from.roomId, token);
            
            setSchedules(previousSchedules => {
                const newSchedules = JSON.parse(JSON.stringify(previousSchedules));
                const fromClass = newSchedules[from.day][from.time][from.roomId];
                const toClass = newSchedules[to.day][to.time][to.roomId];
                newSchedules[from.day][from.time][from.roomId] = toClass;
                newSchedules[to.day][to.time][to.roomId] = fromClass;
                return newSchedules;
            });
            showToast("Classes swapped successfully!");
        } catch (error) {
            console.error("Swap failed:", error);
            showToast("Failed to swap classes");
        } finally {
            setIsAssigning(false);
            setSwapConfirmation({ isOpen: false, details: null });
        }
    };

    const handleCancelSwap = () => {
        setSwapConfirmation({ isOpen: false, details: null });
    };

    const getGridColumnClasses = (building, floorNumber) => {
        switch (building) {
            case "Building A": return "xl:grid-cols-5 lg:grid-cols-3 md:grid-cols-2 grid-cols-[repeat(auto-fit,minmax(160px,1fr))]";
            case "Building B": return floorNumber === 2 ? "grid-cols-5" : "xl:grid-cols-5 lg:grid-cols-3 md:grid-cols-2 grid-cols-[repeat(auto-fit,minmax(160px,1fr))]";
            case "Building C": 
            case "Building F": return "xl:grid-cols-4 lg:grid-cols-2 md:grid-cols-2 grid-cols-[repeat(auto-fit,minmax(160px,1fr))]";
            case "Building D": return "grid-cols-1";
            case "Building E": return floorNumber === 1 ? "xl:grid-cols-6 lg:grid-cols-3 md:grid-cols-2 grid-cols-[repeat(auto-fit,minmax(160px,1fr))]" : "xl:grid-cols-5 lg:grid-cols-3 md:grid-cols-2 grid-cols-[repeat(auto-fit,minmax(160px,1fr))]";
            default: return "grid-cols-[repeat(auto-fit,minmax(160px,1fr))]";
        }
    };

    const getRoomColSpan = (building, roomName) => {
        if (building === "Building A" && roomName === "Conference Room") return "col-span-2";
        if (building === "Building B" && roomName === "Conference Room") return "col-span-4";
        if (building === "Building D" && roomName.includes("Library Room")) return "col-span-full";
        return "";
    };

    return (
        <>
            <ConfirmationModal 
                isOpen={swapConfirmation.isOpen} 
                onCancel={handleCancelSwap} 
                onConfirm={handleConfirmSwap} 
                swapDetails={swapConfirmation.details} 
            />
            
            {toastMessage && (
                <div className="fixed top-20 right-6 bg-red-500 text-white py-2 px-4 rounded-lg shadow-lg z-50 animate-pulse">
                    <p className="font-semibold">{toastMessage}</p>
                </div>
            )}
            
            <div className='p-6 dark:text-white flex flex-col lg:flex-row gap-6 h-[calc(100vh-100px)]'>
                <div className='w-full lg:w-[260px] xl:w-[300px] flex-shrink-0 p-4 bg-white dark:bg-gray-900 border dark:border-gray-700 shadow-lg rounded-xl flex flex-col'>
                    <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold text-num-dark-text dark:text-gray-100">Classes</h3>
                        <hr className="flex-1 border-t border-slate-300 dark:border-slate-700" />
                    </div>
                    <div className="mb-2">
                        <input 
                            type="text" 
                            placeholder="Search" 
                            value={searchTerm} 
                            onChange={(event) => setSearchTerm(event.target.value)} 
                            className="w-full p-2 text-sm border border-gray-300 rounded-md dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200 focus:ring-sky-500 focus:border-sky-500" 
                        />
                    </div>
                    <div className="flex items-center flex-row gap-2 mb-2">
                        <div className="w-1/2">
                            <select 
                                id="degree-select" 
                                value={selectedDegree} 
                                onChange={(event) => setSelectedDegree(event.target.value)} 
                                className="w-full mt-1 p-2 text-xs border border-gray-300 rounded-md dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200 focus:ring-sky-500 focus:border-sky-500"
                            >
                                <option value="All">Degrees</option>
                                {degrees.map(degree => (
                                    <option key={degree} value={degree}>{degree}</option>
                                ))}
                            </select>
                        </div>
                        <div className="w-1/2">
                            <select 
                                id="generation-select" 
                                value={selectedGeneration} 
                                onChange={(event) => setSelectedGeneration(event.target.value)} 
                                className="w-full mt-1 p-2 text-xs border border-gray-300 rounded-md dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200 focus:ring-sky-500 focus:border-sky-500"
                            >
                                <option value="All">Generations</option>
                                {generations.map(generation => (
                                    <option key={generation} value={generation}>{generation}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    
                    <div className="space-y-3 flex-grow overflow-y-auto pr-2">
                        {orderedTimeSlots.map(shift => {
                            const classesInShift = groupedClassesByShift[shift];
                            if (classesInShift && classesInShift.length > 0) {
                                return (
                                    <div key={shift} className="space-y-3">
                                        <div className="flex items-center gap-2 mb-2">
                                            <h4 className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                                {shift}
                                            </h4>
                                            <hr className="flex-1 border-t border-slate-300 dark:border-slate-700" />
                                        </div>
                                        {classesInShift.map((classItem) => (
                                            <div 
                                                key={classItem.classId} 
                                                draggable 
                                                onDragStart={(event) => handleDragStartFromList(event, classItem)} 
                                                onDragEnd={handleDragEnd} 
                                                className="p-2 bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700 border dark:border-gray-700 rounded-lg shadow-sm hover:shadow-md cursor-grab active:cursor-grabbing transition-all flex group"
                                            >
                                                <div className={`w-1.5 h-auto rounded-lg ${generationColorMap[classItem.generation] || 'bg-slate-400'} mr-3`}></div>
                                                <div>
                                                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{classItem.className}</p>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">{classItem.majorName}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                );
                            }
                            return null;
                        })}
                        {Object.values(groupedClassesByShift).every(array => array.length === 0) && (
                            <div className="text-center text-gray-400 dark:text-gray-600 mt-4">
                                No classes available for the selected filters.
                            </div>
                        )}
                    </div>
                </div>
                <div className='flex-1 p-4 sm:p-6 bg-white dark:bg-gray-900 border dark:border-gray-700 shadow-xl rounded-xl flex flex-col overflow-y-auto'>
                    <div className="flex flex-row items-center justify-between mb-4 border-b dark:border-gray-600 pb-3">
                        <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
                            {weekdays.map(day => (
                                <button 
                                    key={day} 
                                    onClick={() => setSelectedDay(day)} 
                                    className={`px-3.5 py-1.5 text-sm font-medium transition-colors ${selectedDay === day ? 'bg-blue-600 dark:bg-blue-600 hover:bg-blue-700 dark:hover:bg-blue-700 text-white shadow' : 'border-r hover:bg-gray-50 dark:hover:bg-gray-800 dark:border-r-gray-500 last:border-r-0'}`}
                                >
                                    {day}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-2">
                            <label htmlFor="time-select" className="text-sm font-medium dark:text-gray-300">Time:</label>
                            <select 
                                id="time-select" 
                                value={selectedTime} 
                                onChange={(event) => setSelectedTime(event.target.value)} 
                                className="p-2 text-sm border border-gray-300 rounded-md dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200 focus:ring-sky-500 focus:border-sky-500"
                            >
                                {timeSlots.map(timeSlot => (
                                    <option key={timeSlot} value={timeSlot}>{timeSlot}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-2">
                        <div className="flex items-center">
                            <select 
                                id="building-select" 
                                value={selectedBuilding} 
                                onChange={(event) => setSelectedBuilding(event.target.value)} 
                                className="block w-full p-2 text-sm text-gray-900 border border-gray-300 rounded-lg bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white"
                            >
                                {buildings.map(building => (
                                    <option key={building} value={building}>{building}</option>
                                ))}
                            </select>
                        </div>
                        <hr className="flex-1 border-t border-slate-300 dark:border-slate-700" />
                    </div>
                    <div className="flex-grow flex flex-col gap-y-4 mt-4">
                        {Object.entries(currentGrid).sort(([floorA], [floorB]) => Number(floorB) - Number(floorA)).map(([floor, rooms]) => (
                            <div key={floor}>
                                <div className="flex items-center gap-2 mb-2">
                                    <h4 className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                        Floor {floor}
                                    </h4>
                                    <hr className="flex-1 border-t border-slate-300 dark:border-slate-700" />
                                </div>
                                <div className={`grid gap-3 ${getGridColumnClasses(selectedBuilding, parseInt(floor))}`}>
                                    {rooms.map((room) => (
                                        <RoomCard
                                        key={room.roomId}
                                        room={room}
                                        classData={getClassForRoom(room.roomId)}
                                        isDragOver={dragOverCell?.roomId === room.roomId}
                                        isWarning={warningCellId === room.roomId}
                                        dragHandlers={{
                                            onDragOver: handleGridCellDragOver,
                                            onDragEnter: (event) => handleGridCellDragEnter(event, room.roomId),
                                            onDragLeave: handleGridCellDragLeave,
                                            onDrop: (event) => handleGridCellDrop(event, room.roomId),
                                            onDragStart: (event) => {
                                                const classData = initialClasses.find(classItem => {
                                                    const scheduleInfo = schedules[selectedDay]?.[selectedTime]?.[room.roomId];
                                                    return scheduleInfo && classItem.classId === scheduleInfo.classId;
                                                });
                                                if (classData) {
                                                    handleDragStartFromGrid(event, classData, room.roomId);
                                                }
                                            },
                                            onDragEnd: handleDragEnd,
                                        }}
                                        className={getRoomColSpan(selectedBuilding, room.roomName)}
                                    />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="mt-auto pt-4 border-t border-gray-200 dark:border-gray-700 flex flex-wrap justify-between items-center gap-3">
                        <div className="text-xs text-gray-600 dark:text-gray-400 space-y-0.5">
                            <p>
                                <span className="inline-block w-2.5 h-2.5 bg-green-500 rounded-full mr-1.5 align-middle"></span> 
                                Available Rooms: {availableRoomsCount}
                            </p>
                            <p>
                                <span className="inline-block w-2.5 h-2.5 bg-red-500 rounded-full mr-1.5 align-middle"></span> 
                                Unavailable Rooms: {unavailableRoomsCount}
                            </p>
                        </div>
                        <button
                            onClick={() => alert('Download PDF functionality to be implemented.')}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md text-sm transition-colors"
                        >
                            Download PDF
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default ScheduleClientView;